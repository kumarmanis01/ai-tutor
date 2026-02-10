import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { applyGrading, SubmitPayload, updateTopicMastery } from '@/lib/tests';
import { updateLearningProfile } from '@/lib/recommendations/engine';
import { adjustDifficultyAfterTest } from '@/lib/personalization/adaptDifficulty';
import { logger } from '@/lib/logger';

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

  const result = await applyGrading(attempt, payload);
  
  // Update topic mastery asynchronously (non-blocking)
  updateTopicMastery(user.id, attempt.id).catch((err) => {
    logger.error('TestsSubmitAPI.updateTopicMastery', {
      userId: user.id,
      attemptId: attempt.id,
      error: err,
    });
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

  res = NextResponse.json({ attemptId: attempt.id, ...result, difficultyFeedback });
  logger.logAPI(req, res, { className: 'TestsSubmitAPI', methodName: 'POST' }, start);
  return res;
}
