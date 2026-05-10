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
 * - 2026-05-09T00:00:00Z | copilot | sync GeneratedQuestion rows into Question table before returning hasActiveQuestions;
 *                                    prevents duplicate job triggers when Question table is empty but GeneratedQuestion has data
 * - 2026-05-09T00:00:00Z | copilot | send hydration-request notification email and skip rejected GeneratedTest rows during promotion
 * - 2026-05-10T00:00:00Z | copilot | enforce content-signature dedupe during on-demand promotion so duplicate GeneratedQuestion rows are not inserted into Question table
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration';
import { ApprovalStatus, JobStatus } from '@/lib/ai-engine/types';
import { sendMailSafe } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import { PRACTICE_HYDRATION_ALERT_EMAIL } from '@/lib/email/functionalityEmails';

export const dynamic = 'force-dynamic';

const HYDRATION_REQUESTED_QUESTION_COUNT = 10;

function normalizeQuestionText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function stableQuestionValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableQuestionValue(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${key}:${stableQuestionValue(obj[key])}`)
      .join(',')}}`;
  }

  if (typeof value === 'string') {
    return normalizeQuestionText(value);
  }

  return String(value ?? '');
}

function buildQuestionContentKey(question: {
  prompt?: unknown;
  choices?: unknown;
  correctAnswer?: unknown;
}): string {
  const prompt = normalizeQuestionText(question.prompt);
  const choices = stableQuestionValue(question.choices);
  const correctAnswer = stableQuestionValue(question.correctAnswer);
  return `${prompt}::${choices}::${correctAnswer}`;
}

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

/**
 * Promotes GeneratedQuestion rows for a topic into the student-facing Question table.
 * Idempotent: uses upsert with update:{} so existing admin moderation state is preserved.
 * Returns the number of rows promoted (0 if GeneratedQuestion is empty for this topic).
 */
async function promoteGeneratedQuestions(topicId: string): Promise<number> {
  const existingActiveQuestions = await prisma.question.findMany({
    where: { topicId, status: 'ACTIVE' },
    select: {
      prompt: true,
      choices: true,
      correctAnswer: true,
    },
  });
  const existingContentKeys = new Set<string>(
    existingActiveQuestions.map((q) =>
      buildQuestionContentKey({
        prompt: q.prompt,
        choices: q.choices,
        correctAnswer: q.correctAnswer,
      }),
    ),
  );

  const generatedRows = await prisma.generatedQuestion.findMany({
    where: { test: { topicId, status: { not: ApprovalStatus.Rejected } } },
    select: {
      id: true,
      type: true,
      question: true,
      options: true,
      answer: true,
      test: {
        select: {
          difficulty: true,
          topicId: true,
          topic: {
            select: {
              chapter: {
                select: {
                  name: true,
                  subject: {
                    select: {
                      name: true,
                      class: {
                        select: {
                          grade: true,
                          board: { select: { slug: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (generatedRows.length === 0) return 0;

  let promoted = 0;
  const promotedContentKeys = new Set<string>();
  for (const gq of generatedRows) {
    const correctAnswer =
      typeof gq.answer === 'string' ? gq.answer : JSON.stringify(gq.answer ?? '');
    const contentKey = buildQuestionContentKey({
      prompt: gq.question,
      choices: gq.options,
      correctAnswer,
    });
    if (existingContentKeys.has(contentKey) || promotedContentKeys.has(contentKey)) {
      continue;
    }

    const ch = gq.test.topic?.chapter;
    const sub = ch?.subject;
    const cls = sub?.class;

    // update:{} preserves any existing admin moderation state (QUARANTINED / REJECTED).
    // create: status defaults to ACTIVE via schema @default(ACTIVE).
    await prisma.question.upsert({
      where: { id: gq.id },
      update: {},
      create: {
        id: gq.id,
        type: gq.type || 'mcq',
        prompt: gq.question,
        choices: gq.options ?? undefined,
        correctAnswer,
        difficulty: gq.test.difficulty ?? null,
        subject: sub?.name ?? null,
        chapter: ch?.name ?? null,
        grade: cls?.grade != null ? String(cls.grade) : null,
        board: cls?.board?.slug ?? null,
        topicId: gq.test.topicId ?? null,
        source: 'generated',
      },
    });
    promotedContentKeys.add(contentKey);
    promoted++;
  }

  return promoted;
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

  // If the Question table is empty but GeneratedQuestion rows exist for this topic,
  // promote them now so the student sees their questions immediately instead of
  // triggering a redundant hydration job.
  // This handles: (a) admin-approved GeneratedTest with no prior sync,
  //               (b) completed jobs where the worker soft-sync failed,
  //               (c) pre-existing data from before soft-sync was introduced.
  let promoted = 0;
  if (activeCount === 0 && !runningJob) {
    try {
      promoted = await promoteGeneratedQuestions(topicId);
      if (promoted > 0) {
        logger.info('[PRACTICE_HYDRATE] promoted GeneratedQuestion rows to Question table on-demand', {
          topicId,
          promoted,
        });
      }
    } catch (syncErr) {
      // Non-fatal -- if sync fails, fall through; caller will still see hasActiveQuestions=false
      logger.error('[PRACTICE_HYDRATE] on-demand promotion failed', { topicId, error: String(syncErr) });
    }
  }

  return {
    hasActiveQuestions: activeCount > 0 || promoted > 0,
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

  void sendMailSafe({
    to: PRACTICE_HYDRATION_ALERT_EMAIL,
    subject: `Practice hydration requested for topic ${session.topicId}`,
    text: [
      'A practice hydration request was submitted.',
      '',
      `Session ID: ${sessionId}`,
      `Student ID: ${studentId}`,
      `Topic ID: ${session.topicId}`,
      `Has active questions: ${hydrationState.hasActiveQuestions}`,
      `Running job ID: ${hydrationState.runningJobId ?? 'none'}`,
    ].join('\n'),
    html: `
      <p>A practice hydration request was submitted.</p>
      <ul>
        <li><strong>Session ID:</strong> ${sessionId}</li>
        <li><strong>Student ID:</strong> ${studentId}</li>
        <li><strong>Topic ID:</strong> ${session.topicId}</li>
        <li><strong>Has active questions:</strong> ${hydrationState.hasActiveQuestions}</li>
        <li><strong>Running job ID:</strong> ${hydrationState.runningJobId ?? 'none'}</li>
      </ul>
    `,
  });

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
