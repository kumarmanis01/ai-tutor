/**
 * FILE OBJECTIVE:
 * - Serve fresh premium practice questions for a structured session after the initial practice set is completed.
 * - Emits a canonical practice-more analytics event when a student successfully requests more practice.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/session/[sessionId]/practice/more/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T12:55:00Z | copilot | created for "practice more" once-per-day feature
 * - 2026-05-13T00:00:00Z | copilot | emit canonical practice more analytics on successful premium refresh
 */

import { NextResponse } from 'next/server';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { checkPracticeMoreCap, recordPracticeMoreUsage } from '@/lib/practice/practiceMoreCap';
import { isPremiumUser } from '@/lib/subscription';
import { enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const PRACTICE_QUESTION_TARGET_COUNT = 5;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Parse and normalize question metadata from session.
 * Ensures served question IDs are tracked correctly.
 */
function getServedPracticeIds(meta: unknown): string[] {
  try {
    const m = meta as Record<string, unknown> | null;
    if (!m || !Array.isArray(m.servedPracticeIds)) return [];
    return m.servedPracticeIds.filter((id) => typeof id === 'string');
  } catch {
    return [];
  }
}

/**
 * Sample fresh questions from the topic that have NOT been served in this session.
 * If pool is insufficient, returns empty array (triggers hydration check at caller).
 */
async function sampleFreshQuestions(
  topicId: string,
  excludeQuestionIds: string[],
  targetCount: number,
): Promise<{ id: string; type: string; prompt: string; choices: unknown; difficulty: string | null; correctAnswer: string | null }[]> {
  const questions = await prisma.question.findMany({
    where: {
      topicId,
      status: 'ACTIVE',
      // Exclude questions already served in this session
      id: { notIn: excludeQuestionIds.length > 0 ? excludeQuestionIds : undefined },
    },
    select: {
      id: true,
      type: true,
      prompt: true,
      choices: true,
      difficulty: true,
      correctAnswer: true,
    },
    // Random sample: order by random, limit to target count
    take: targetCount,
  });

  // Shuffle to avoid bias toward the first results
  return questions.sort(() => Math.random() - 0.5).slice(0, targetCount);
}

/**
 * Check if topic has enough questions; trigger hydration if not.
 */
async function ensureQuestionsAvailable(topicId: string): Promise<boolean> {
  try {
    const count = await prisma.question.count({
      where: { topicId, status: 'ACTIVE' },
    });

    // If pool is too small, request hydration
    if (count < PRACTICE_QUESTION_TARGET_COUNT) {
      logger.info('[PRACTICE_MORE_HYDRATION_TRIGGERED]', { topicId, poolSize: count });
      const result = await enqueueQuestionsHydration({
        topicId,
        questionsPerDifficulty: PRACTICE_QUESTION_TARGET_COUNT + 5, // extra buffer
      });
      return result.created || result.reason === 'content_exists'; // OK if already exists
    }

    return true;
  } catch (err) {
    logger.error('[PRACTICE_MORE_HYDRATION_CHECK_FAILED]', {
      topicId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * POST /api/session/[sessionId]/practice/more
 *
 * Body: {} (empty)
 *
 * Response (200):
 *   {
 *     success: true,
 *     message: string,
 *     questions: { id, type, prompt, choices, difficulty, correctAnswer }[],
 *     sessionId: string,
 *   }
 *
 * Response (402):
 *   { error: 'Free tier users cannot use this feature' }
 *
 * Response (409):
 *   { error: 'Already used practice more today' }
 *   or
 *   { error: 'Practice questions not yet completed' }
 *
 * Response (503):
 *   { error: 'Practice more is temporarily unavailable. Please try again in a moment.' }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const start = Date.now();
  let res: Response;

  // ── Auth ──────────────────────────────────────────────────────────────────

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'PracticeMoreAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Feature flag ──────────────────────────────────────────────────────────

  if (!isSessionEngineEnabled()) {
    res = NextResponse.json({ error: 'Session engine disabled' }, { status: 503 });
    logger.logAPI(req, res, { className: 'PracticeMoreAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Parse params ──────────────────────────────────────────────────────────

  const { sessionId } = await params;

  // ── Check premium tier ────────────────────────────────────────────────────

  const isPremium = await isPremiumUser(user.id);
  if (!isPremium) {
    res = NextResponse.json(
      { error: 'Free tier users cannot use this feature', code: 'NOT_PREMIUM' },
      { status: 402 },
    );
    logger.logAPI(req, res, { className: 'PracticeMoreAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Check daily cap ───────────────────────────────────────────────────────

  const capStatus = await checkPracticeMoreCap(user.id);
  if (!capStatus.allowed) {
    res = NextResponse.json(
      {
        error: 'You can use practice more once per day. Please try again tomorrow.',
        code: 'DAILY_CAP_REACHED',
        nextAvailableAt: capStatus.nextAvailableAt.toISOString(),
      },
      { status: 409 },
    );
    logger.logAPI(req, res, { className: 'PracticeMoreAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Load session ──────────────────────────────────────────────────────────

  const session = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId: user.id },
  });

  if (!session) {
    res = NextResponse.json({ error: 'Session not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'PracticeMoreAPI', methodName: 'POST' }, start);
    return res;
  }

  const sessionMeta = (session.meta as Record<string, unknown>) ?? {};

  // ── Verify PRACTICE phase and completion ──────────────────────────────────

  if (session.state !== 'PRACTICE') {
    res = NextResponse.json(
      { error: 'Session must be in PRACTICE phase to use practice more', code: 'INVALID_PHASE' },
      { status: 409 },
    );
    logger.logAPI(req, res, { className: 'PracticeMoreAPI', methodName: 'POST' }, start);
    return res;
  }

  if (!sessionMeta.practiceResult) {
    res = NextResponse.json(
      { error: 'Practice questions must be completed before requesting more', code: 'PRACTICE_NOT_SUBMITTED' },
      { status: 409 },
    );
    logger.logAPI(req, res, { className: 'PracticeMoreAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Ensure questions available (trigger hydration if needed) ───────────────

  const hydrationReady = await ensureQuestionsAvailable(session.topicId);
  if (!hydrationReady) {
    res = NextResponse.json(
      {
        error: 'Practice more is temporarily unavailable. Please try again in a moment.',
        code: 'HYDRATION_FAILED',
      },
      { status: 503 },
    );
    logger.logAPI(req, res, { className: 'PracticeMoreAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Sample fresh questions ────────────────────────────────────────────────

  const servedIds = getServedPracticeIds(sessionMeta);
  const freshQuestions = await sampleFreshQuestions(
    session.topicId,
    servedIds,
    PRACTICE_QUESTION_TARGET_COUNT,
  );

  // Check if we got enough fresh questions
  if (freshQuestions.length < PRACTICE_QUESTION_TARGET_COUNT) {
    logger.warn('[PRACTICE_MORE_INSUFFICIENT_POOL]', {
      sessionId,
      topicId: session.topicId,
      servedCount: servedIds.length,
      freshCount: freshQuestions.length,
      targetCount: PRACTICE_QUESTION_TARGET_COUNT,
    });

    // Pool exhausted despite hydration attempt
    res = NextResponse.json(
      {
        error: 'Not enough fresh practice questions available. You have completed too many.',
        code: 'NO_FRESH_QUESTIONS',
      },
      { status: 409 },
    );
    logger.logAPI(req, res, { className: 'PracticeMoreAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Update session: reset practice state, set new questions ───────────────

  const updatedServedIds = [...servedIds, ...freshQuestions.map((q) => q.id)];
  const newMeta = {
    ...sessionMeta,
    practiceResult: undefined, // Clear so UI re-renders fresh
    servedPracticeIds: updatedServedIds,
  };

  await prisma.structuredSession.update({
    where: { id: session.id },
    data: { meta: newMeta },
  });

  // ── Record usage ──────────────────────────────────────────────────────────

  const recorded = await recordPracticeMoreUsage(user.id);
  if (!recorded) {
    logger.warn('[PRACTICE_MORE_USAGE_RECORDING_FAILED]', { studentId: user.id, sessionId });
    // Non-blocking: cap is soft (usage already happens)
  }

  logger.info('[PRACTICE_MORE_SUCCESS]', {
    sessionId,
    studentId: user.id,
    topicId: session.topicId,
    freshQuestionsCount: freshQuestions.length,
  });

  await emitServerAnalyticsEvent(
    {
      eventType: ANALYTICS_EVENTS.STUDENT.PRACTICE_MORE,
      userId: user.id,
      courseId: session.topicId,
      metadata: {
        sessionId,
        topicId: session.topicId,
        freshQuestionsCount: freshQuestions.length,
      },
    },
    'session.practice.more',
  );

  // ── Return fresh questions ────────────────────────────────────────────────

  res = NextResponse.json({
    success: true,
    message: 'Fresh practice questions loaded. Complete this set to unlock more.',
    questions: freshQuestions,
    sessionId,
  });

  logger.logAPI(req, res, { className: 'PracticeMoreAPI', methodName: 'POST' }, start);
  return res;
}
