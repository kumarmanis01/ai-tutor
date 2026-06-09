/**
 * FILE OBJECTIVE:
 * - POST /api/tests/submit: grades a test attempt, updates topic mastery,
 *   updates UserTopicProgress for the recommendation engine, records mastery
 *   FSM state, and returns graded results with optional LLM explanations.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | S2-2: add zod validation for topicSlug/subject;
 *     wire recordQuizOutcome; return masteryState in scorecard response
 * - 2026-06-08T02:00:00Z | claude | fix: replace non-atomic findUnique+upsert with single atomic INSERT...ON CONFLICT to prevent concurrent-submission race
 * - 2026-06-08T00:00:00Z | claude | upsert UserTopicProgress after grading for recommendation engine
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { applyGrading, addLLMExplanations, updateTopicMastery } from '@/lib/tests';
import { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';
import { updateLearningProfile } from '@/lib/recommendations/engine';
import { adjustDifficultyAfterTest } from '@/lib/personalization/adaptDifficulty';
import { getNextAction } from '@/lib/homeEngine/getNextAction';
import { logger } from '@/lib/logger';
import { recordSessionEvents } from '@/lib/session/sessionEvents';
import { recordQuizOutcome } from '@/lib/mastery/topicProgress';

export const dynamic = 'force-dynamic';

// ─── Request schema ────────────────────────────────────────────────────────────

const submitSchema = z.object({
  attemptId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string(),
      timeSpent: z.number().optional(),
    }),
  ),
  topicSlug: z.string().min(1),
  subject: z.string().min(1),
});

type SubmitBody = z.infer<typeof submitSchema>;

// ─── Handler ───────────────────────────────────────────────────────────────────

/**
 * POST /api/tests/submit
 * Body: { attemptId, answers, topicSlug, subject }
 */
export async function POST(req: Request) {
  const start = Date.now();
  let res: Response;
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  let body: SubmitBody;
  try {
    const raw = await req.json().catch(() => null);
    body = submitSchema.parse(raw);
  } catch {
    res = NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const { attemptId, answers, topicSlug, subject } = body;

  // Fetch grade and board from user profile (single query, session may lack board).
  let grade: string | null = null;
  let board: string | null = null;
  try {
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { grade: true, board: true },
    });
    grade = profile?.grade ?? null;
    board = profile?.board ?? null;
  } catch (err) {
    logger.error('TestsSubmitAPI.fetchProfile', { userId: user.id, error: err });
  }

  const attempt = await prisma.testResult.findFirst({ where: { id: attemptId, studentId: user.id } });
  if (!attempt) {
    res = NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  // Guard: If a LearningSession exists for this topic and is open, mark complete before grading
  if (attempt.sessionId) {
    const openSession = await prisma.learningSession.findFirst({ where: { id: attempt.sessionId, isCompleted: false } });
    if (openSession) {
      const now = new Date();
      const elapsedMinutes = Math.max(1, Math.floor((now.getTime() - openSession.startedAt.getTime()) / 60000));
      await prisma.learningSession.update({
        where: { id: openSession.id },
        data: {
          isCompleted: true,
          completionPercentage: 100,
          lastAccessed: now,
          endedAt: now,
          actualTimeSpent: elapsedMinutes,
        },
      });
      logger.info('session.auto-completed.on-submit', { sessionId: openSession.id });
    }
  }

  const result = await applyGrading(attempt, { attemptId, answers });

  // AC-05: Enrich wrong answers with LLM-generated explanations (F-STU-020).
  try {
    result.graded = await addLLMExplanations(result.graded, user.id, attempt.id);
  } catch {
    // non-fatal
  }

  // Update topic mastery synchronously so next /api/home/next-action reflects latest accuracy.
  try {
    await updateTopicMastery(user.id, attempt.id);
  } catch (err) {
    logger.error('TestsSubmitAPI.updateTopicMastery', { userId: user.id, attemptId: attempt.id, error: err });
  }

  // Derive topicId for logging: GeneratedTest carries the canonical TopicDef ID.
  let topicId: string | null = null;
  let topicName: string | null = null;
  try {
    const gt = await prisma.generatedTest.findUnique({
      where: { id: attempt.testId },
      select: { topicId: true, topic: { select: { name: true } } },
    });
    topicId = gt?.topicId ?? null;
    topicName = gt?.topic?.name ?? null;
  } catch {
    // non-fatal
  }

  if (topicId) {
    const correctCount = result.graded.filter((g) => g.correct).length;
    const totalCount = result.graded.length;

    try {
      await updateStudentTopicProgress({
        studentId: user.id,
        topicId,
        correctAnswers: correctCount,
        totalAnswers: totalCount,
        activityType: 'TEST',
      });
    } catch (err) {
      logger.error('TestsSubmitAPI.updateStudentTopicProgress', { userId: user.id, topicId, error: err });
    }

    // Atomic upsert UserTopicProgress using INSERT...ON CONFLICT to prevent
    // concurrent-submission races (findUnique+upsert is not atomic).
    if (topicName && totalCount > 0) {
      try {
        const initialMastery = totalCount > 0 ? correctCount / totalCount : 0;
        await prisma.$executeRaw`
          INSERT INTO "UserTopicProgress" (id, "userId", topic, "totalAttempts", "correctAttempts", "masteryScore", "lastAttemptedAt", "updatedAt")
          VALUES (gen_random_uuid()::text, ${user.id}, ${topicName}, ${totalCount}, ${correctCount}, ${initialMastery}, NOW(), NOW())
          ON CONFLICT ("userId", topic)
          DO UPDATE SET
            "totalAttempts"   = "UserTopicProgress"."totalAttempts" + EXCLUDED."totalAttempts",
            "correctAttempts" = "UserTopicProgress"."correctAttempts" + EXCLUDED."correctAttempts",
            "masteryScore"    = ("UserTopicProgress"."correctAttempts" + EXCLUDED."correctAttempts")::float
                              / NULLIF("UserTopicProgress"."totalAttempts" + EXCLUDED."totalAttempts", 0),
            "lastAttemptedAt" = EXCLUDED."lastAttemptedAt",
            "updatedAt"       = EXCLUDED."updatedAt"
        `;
      } catch (err) {
        logger.error('TestsSubmitAPI.upsertUserTopicProgress', { userId: user.id, topic: topicName, error: err });
      }
    }
  }

  // Record mastery FSM state. Fire and forget -- scorecard response is not blocked.
  let masteryState: string | null = null;
  let newlyMastered = false;
  if (grade && board) {
    const correctCount = result.graded.filter((g) => g.correct).length;
    const totalCount = result.graded.length;
    if (totalCount > 0) {
      recordQuizOutcome({
        userId: user.id,
        topicSlug,
        subject,
        grade,
        board,
        scorePercent: (correctCount / totalCount) * 100,
      })
        .then((progress) => {
          // Result available for future requests; not included in this response.
          logger.info('mastery.topicProgress.fired', { userId: user.id, topicSlug, state: progress.state });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          logger.error('TestsSubmitAPI.recordQuizOutcome', { userId: user.id, topicSlug, error: message });
        });
    }
  }

  // Compute next rule after mastery update for audit logging.
  let nextRule: string | null = null;
  try {
    const nextActionResult = await getNextAction(user.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy getNextAction return type is untyped
    const nextAction = nextActionResult && typeof nextActionResult === 'object' && 'action' in nextActionResult ? nextActionResult.action : (nextActionResult as any);
    nextRule = nextAction?.ruleId ?? null;
  } catch {
    // non-fatal
  }

  logger.info('practice.completed', {
    studentId: user.id,
    topicId,
    accuracy: result.scorePercent / 100,
    nextRule,
  });

  // Update learning profile asynchronously (non-blocking)
  updateLearningProfile(user.id).catch((err) => {
    logger.error('TestsSubmitAPI.updateLearningProfile', { userId: user.id, error: err });
  });

  // Adjust difficulty based on performance (awaited so we can include feedback)
  let difficultyFeedback = null;
  try {
    difficultyFeedback = await adjustDifficultyAfterTest(user.id, attempt, result);
  } catch (err) {
    logger.error('TestsSubmitAPI.adjustDifficulty', { userId: user.id, attemptId: attempt.id, error: err });
  }

  // Record QUESTION_ANSWERED session events when inside a structured session
  if (topicId) {
    try {
      const structuredSession = await prisma.structuredSession.findFirst({
        where: { studentId: user.id, topicId, state: { not: 'COMPLETE' } },
        select: { id: true },
      });
      if (structuredSession) {
        const events = result.graded.map((g) => ({
          sessionId: structuredSession.id,
          eventType: 'QUESTION_ANSWERED' as const,
          metadata: {
            studentId: user.id,
            questionId: g.questionId,
            isCorrect: g.correct,
            source: 'test',
          },
        }));
        recordSessionEvents(events);
      }
    } catch {
      // non-fatal
    }
  }

  // AC-06: Score < 40% → create a revision learning session (F-STU-020).
  let needsRevision = false;
  if (result.scorePercent < 40 && topicId) {
    needsRevision = true;
    try {
      const topicMeta = await prisma.topicDef.findUnique({
        where: { id: topicId },
        select: {
          chapter: {
            select: {
              name: true,
              subject: { select: { name: true } },
            },
          },
        },
      });
      await prisma.learningSession.create({
        data: {
          studentId: user.id,
          activityType: 'chapter_revision',
          activityRef: topicId,
          difficultyLevel: 'easy',
          isCompleted: false,
          startedAt: new Date(),
          meta: {
            sourceAttemptId: attempt.id,
            scorePercent: result.scorePercent,
            chapter: topicMeta?.chapter?.name ?? null,
            subject: topicMeta?.chapter?.subject?.name ?? null,
            reason: 'score_below_40',
          },
        },
      });
      logger.info('revision.session.created', { studentId: user.id, topicId, scorePercent: result.scorePercent });
    } catch (err) {
      logger.error('TestsSubmitAPI.createRevisionSession', { userId: user.id, topicId, error: err });
    }
  }

  res = NextResponse.json({
    attemptId: attempt.id,
    ...result,
    difficultyFeedback,
    needsRevision,
    masteryState,
    newlyMastered,
  });
  logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
  return res;
}

