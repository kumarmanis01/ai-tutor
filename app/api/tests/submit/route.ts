import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { applyGrading, SubmitPayload, updateTopicMastery } from '@/lib/tests';
import { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';
import { updateLearningProfile } from '@/lib/recommendations/engine';
import { adjustDifficultyAfterTest } from '@/lib/personalization/adaptDifficulty';
import { getNextAction } from '@/lib/homeEngine/getNextAction';
import { logger } from '@/lib/logger';
import { recordSessionEvents } from '@/lib/session/sessionEvents';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tests/submit
 * Body: { attemptId: string, answers: [{ questionId, answer, timeSpent? }] }
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

  const payload = (await req.json().catch(() => null)) as SubmitPayload | null;
  if (!payload?.attemptId || !Array.isArray(payload.answers)) {
    res = NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const attempt = await prisma.testResult.findFirst({ where: { id: payload.attemptId, studentId: user.id } });
  if (!attempt) {
    res = NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
    return res;
  }


  // Guard: If a LearningSession exists for this topic and is open, mark complete before grading
  if (attempt.sessionId) {
    const session = await prisma.learningSession.findFirst({ where: { id: attempt.sessionId, isCompleted: false } });
    if (session) {
      const now = new Date();
      const elapsedMinutes = Math.max(1, Math.floor((now.getTime() - session.startedAt.getTime()) / 60000));
      await prisma.learningSession.update({
        where: { id: session.id },
        data: {
          isCompleted: true,
          completionPercentage: 100,
          lastAccessed: now,
          endedAt: now,
          actualTimeSpent: elapsedMinutes,
        },
      });
      logger.info('session.auto-completed.on-submit', { sessionId: session.id });
    }
  }

  const result = await applyGrading(attempt, payload);

  // Update topic mastery synchronously so the next call to /api/home/next-action
  // always reflects the latest accuracy and resolved AttentionFlags.
  try {
    await updateTopicMastery(user.id, attempt.id);
  } catch (err) {
    logger.error('TestsSubmitAPI.updateTopicMastery', {
      userId: user.id,
      attemptId: attempt.id,
      error: err,
    });
  }

  // Derive topicId for logging: GeneratedTest carries the canonical TopicDef ID.
  let topicId: string | null = null;
  try {
    const gt = await prisma.generatedTest.findUnique({
      where: { id: attempt.testId },
      select: { topicId: true },
    });
    topicId = gt?.topicId ?? null;
  } catch {
    // non-fatal -- test may not be a GeneratedTest
  }

  if (topicId) {
    try {
      const correctCount = result.graded.filter((g) => g.correct).length;
      await updateStudentTopicProgress({
        studentId: user.id,
        topicId,
        correctAnswers: correctCount,
        totalAnswers: result.graded.length,
        activityType: 'TEST',
      });
    } catch (err) {
      logger.error('TestsSubmitAPI.updateStudentTopicProgress', {
        userId: user.id,
        topicId,
        error: err,
      });
    }
  }

  // Compute next rule after mastery update for audit logging.
  let nextRule: string | null = null;
  try {
    const nextActionResult = await getNextAction(user.id);
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
    logger.error('TestsSubmitAPI.updateLearningProfile', {
      userId: user.id,
      error: err,
    });
  });

  // Adjust difficulty based on performance (awaited so we can include feedback)
  let difficultyFeedback = null;
  try {
    difficultyFeedback = await adjustDifficultyAfterTest(user.id, attempt, result);
  } catch (err) {
    logger.error('TestsSubmitAPI.adjustDifficulty', {
      userId: user.id,
      attemptId: attempt.id,
      error: err,
    });
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

  res = NextResponse.json({ attemptId: attempt.id, ...result, difficultyFeedback });
  logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
  return res;
}
