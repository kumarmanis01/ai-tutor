/**
 * FILE OBJECTIVE:
 * - Provide status + manual trigger endpoints for PRACTICE content hydration when a session is pending.
 * - Enables UI to show "Generate practice questions" only when no job is already running.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/session/[sessionId]/practice/hydrate/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-08T00:00:00Z | copilot | add GET/POST practice hydration fallback endpoint for pending PRACTICE sessions
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration';
import { JobStatus } from '@/lib/ai-engine/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const HYDRATION_REQUESTED_QUESTION_COUNT = 10;

type SessionRow = {
  id: string;
  topicId: string;
  state: string;
};

async function loadOwnedSession(sessionId: string, studentId: string): Promise<SessionRow | null> {
  return prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId },
    select: { id: true, topicId: true, state: true },
  });
}

async function getPracticeHydrationState(topicId: string): Promise<{
  hasActiveQuestions: boolean;
  runningJobId: string | null;
}> {
  const [activeCount, runningJob] = await Promise.all([
    prisma.question.count({ where: { topicId, status: 'ACTIVE' } }),
    prisma.hydrationJob.findFirst({
      where: {
        jobType: 'questions',
        topicId,
        status: { in: [JobStatus.Pending, JobStatus.Running] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
  ]);

  return {
    hasActiveQuestions: activeCount > 0,
    runningJobId: runningJob?.id ?? null,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const start = Date.now();
  const { sessionId } = await params;

  const authSession = await getServerSessionForHandlers();
  const studentId = authSession?.user?.id;
  if (!studentId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'PracticeHydrateAPI', methodName: 'GET' }, start);
    return res;
  }

  if (!isSessionEngineEnabled()) {
    const res = NextResponse.json({ error: 'Session engine disabled' }, { status: 503 });
    logger.logAPI(req, res, { className: 'PracticeHydrateAPI', methodName: 'GET' }, start);
    return res;
  }

  const session = await loadOwnedSession(sessionId, studentId);
  if (!session) {
    const res = NextResponse.json({ error: 'Session not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'PracticeHydrateAPI', methodName: 'GET' }, start);
    return res;
  }

  const hydrationState = await getPracticeHydrationState(session.topicId);

  const res = NextResponse.json({
    hasActiveQuestions: hydrationState.hasActiveQuestions,
    isHydrationRunning: !!hydrationState.runningJobId,
    runningJobId: hydrationState.runningJobId,
    sessionPhase: session.state,
  });
  logger.logAPI(req, res, { className: 'PracticeHydrateAPI', methodName: 'GET' }, start);
  return res;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const start = Date.now();
  const { sessionId } = await params;

  const authSession = await getServerSessionForHandlers();
  const studentId = authSession?.user?.id;
  if (!studentId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'PracticeHydrateAPI', methodName: 'POST' }, start);
    return res;
  }

  if (!isSessionEngineEnabled()) {
    const res = NextResponse.json({ error: 'Session engine disabled' }, { status: 503 });
    logger.logAPI(req, res, { className: 'PracticeHydrateAPI', methodName: 'POST' }, start);
    return res;
  }

  const session = await loadOwnedSession(sessionId, studentId);
  if (!session) {
    const res = NextResponse.json({ error: 'Session not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'PracticeHydrateAPI', methodName: 'POST' }, start);
    return res;
  }

  const hydrationState = await getPracticeHydrationState(session.topicId);

  if (hydrationState.hasActiveQuestions) {
    const res = NextResponse.json({
      enqueued: false,
      reason: 'already_available',
      jobId: hydrationState.runningJobId,
    });
    logger.logAPI(req, res, { className: 'PracticeHydrateAPI', methodName: 'POST' }, start);
    return res;
  }

  if (hydrationState.runningJobId) {
    const res = NextResponse.json({
      enqueued: false,
      reason: 'already_running',
      jobId: hydrationState.runningJobId,
    });
    logger.logAPI(req, res, { className: 'PracticeHydrateAPI', methodName: 'POST' }, start);
    return res;
  }

  const enqueueResult = await enqueueQuestionsHydration({
    topicId: session.topicId,
    language: 'en',
    difficulty: 'medium',
    force: true,
    questionsPerDifficulty: HYDRATION_REQUESTED_QUESTION_COUNT,
  });

  const res = NextResponse.json({
    enqueued: enqueueResult.created,
    reason: enqueueResult.created ? 'enqueued' : enqueueResult.reason,
    jobId: enqueueResult.created ? enqueueResult.jobId : enqueueResult.jobId ?? null,
  });

  logger.info('[SESSION_PRACTICE_HYDRATION_MANUAL_TRIGGER]', {
    sessionId,
    studentId,
    topicId: session.topicId,
    enqueueResult,
  });

  logger.logAPI(req, res, { className: 'PracticeHydrateAPI', methodName: 'POST' }, start);
  return res;
}
