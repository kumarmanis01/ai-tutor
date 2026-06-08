/**
 * FILE OBJECTIVE:
 * - POST /api/tests/submit: grades a test attempt, updates topic mastery,
 *   updates UserTopicProgress for the recommendation engine, and returns
 *   graded results with optional LLM explanations.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | upsert UserTopicProgress after grading for recommendation engine
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { applyGrading, addLLMExplanations, SubmitPayload, updateTopicMastery } from '@/lib/tests';
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

  // AC-05: Enrich wrong answers with LLM-generated explanations (F-STU-020).
  // Non-blocking: graded result falls back to DB explanations or empty on failure.
  try {
    result.graded = await addLLMExplanations(result.graded, user.id, attempt.id);
  } catch {
    // non-fatal
  }

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
  let topicName: string | null = null;
  try {
    const gt = await prisma.generatedTest.findUnique({
      where: { id: attempt.testId },
      select: { topicId: true, topic: { select: { name: true } } },
    });
    topicId = gt?.topicId ?? null;
    topicName = gt?.topic?.name ?? null;
  } catch {
    // non-fatal -- test may not be a GeneratedTest
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
      logger.error('TestsSubmitAPI.updateStudentTopicProgress', {
        userId: user.id,
        topicId,
        error: err,
      });
    }

    // Upsert UserTopicProgress (free-text topic) for the recommendation engine.
    // Uses topic name from TopicDef; skips silently if name is unavailable.
    if (topicName && totalCount > 0) {
      try {
        const existing = await prisma.userTopicProgress.findUnique({
          where: { userId_topic: { userId: user.id, topic: topicName } },
          select: { totalAttempts: true, correctAttempts: true },
        });
        const newTotal = (existing?.totalAttempts ?? 0) + totalCount;
        const newCorrect = (existing?.correctAttempts ?? 0) + correctCount;
        const masteryScore = newTotal > 0 ? newCorrect / newTotal : 0;
        await prisma.userTopicProgress.upsert({
          where: { userId_topic: { userId: user.id, topic: topicName } },
          create: {
            userId: user.id,
            topic: topicName,
            totalAttempts: totalCount,
            correctAttempts: correctCount,
            masteryScore,
            lastAttemptedAt: new Date(),
          },
          update: {
            totalAttempts: newTotal,
            correctAttempts: newCorrect,
            masteryScore,
            lastAttemptedAt: new Date(),
          },
        });
      } catch (err) {
        logger.error('TestsSubmitAPI.upsertUserTopicProgress', {
          userId: user.id,
          topic: topicName,
          error: err,
        });
      }
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

  // AC-06: Score < 40% → create a revision learning session (F-STU-020).
  // Gives the home engine a pending 'chapter_revision' session to surface.
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
      logger.info('revision.session.created', {
        studentId: user.id,
        topicId,
        scorePercent: result.scorePercent,
      });
    } catch (err) {
      logger.error('TestsSubmitAPI.createRevisionSession', {
        userId: user.id,
        topicId,
        error: err,
      });
    }
  }

  res = NextResponse.json({ attemptId: attempt.id, ...result, difficultyFeedback, needsRevision });
  logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
  return res;
}
