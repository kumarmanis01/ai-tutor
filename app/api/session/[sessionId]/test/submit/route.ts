/**
 * FILE OBJECTIVE:
 * - Grade structured-session test submissions and persist test results for phase progression.
 * - Emits canonical quiz attempt/pass analytics from the served test payload actually graded.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/session/analytics.routes.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-03-07 | Manish Kumar | created (GAP-02 second half: TEST phase
 *                               submission path, enables mastery weight 0.3).
 * - 2026-05-09T00:00:00Z | copilot | accept optional testId and grade against
 *                               the exact delivered test version to prevent
 *                               question-id mismatches returning 0/0.
 * - 2026-05-13T00:00:00Z | copilot | grade structured-session tests against served Question bank rows only
 * - 2026-05-13T00:00:00Z | copilot | emit canonical quiz attempted and quiz passed analytics from test submission results
 */

import { NextResponse } from 'next/server';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';
import { recordSessionEvents } from '@/lib/session/sessionEvents';
import { normalizeAnswer } from '@/lib/tests';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
const QUIZ_PASSING_SCORE = 0.7;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmitBody {
  answers: { questionId: string; answer: string }[];
  testId?: string;
}

interface GradedAnswer {
  questionId: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string | null;
}

/** Subset of Question fields needed for grading. */
interface TestQuestionForGrading {
  id: string;
  type: string;
  choices: unknown;
  correctAnswer: string | null;
}

/** Shape stored in StructuredSession.meta.testResult. */
interface TestResult {
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  gradedAt: string;
  answers: { questionId: string; isCorrect: boolean; correctAnswer: string | null }[];
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * POST /api/session/[sessionId]/test/submit
 *
 * Body: { answers: { questionId: string; answer: string }[] }
 *
 * Response (200):
 *   {
 *     score: number,
 *     percentage: number,
 *     correctAnswers: number,
 *     totalAnswers: number,
 *     results: { questionId, isCorrect, correctAnswer }[],
 *     nextPhase: 'HOMEWORK'
 *   }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const start = Date.now();
  let res: Response;

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'TestSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  if (!isSessionEngineEnabled()) {
    res = NextResponse.json({ error: 'Session engine disabled' }, { status: 503 });
    logger.logAPI(req, res, { className: 'TestSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const { sessionId } = await params;

  const body = (await req.json().catch(() => null)) as SubmitBody | null;
  if (!body || !Array.isArray(body.answers) || body.answers.length === 0) {
    res = NextResponse.json(
      { error: 'answers[] is required and must be non-empty' },
      { status: 400 },
    );
    logger.logAPI(req, res, { className: 'TestSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const session = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId: user.id },
  });

  if (!session) {
    res = NextResponse.json({ error: 'Session not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'TestSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const sessionMeta = (session.meta as Record<string, unknown>) ?? {};

  // ── Idempotency gate ──────────────────────────────────────────────────────
  if (sessionMeta.testResult) {
    const cached = sessionMeta.testResult as TestResult;
    const shouldRegradeEmptyCachedResult =
      cached.totalAnswers === 0 && Array.isArray(body.answers) && body.answers.length > 0;

    if (shouldRegradeEmptyCachedResult) {
      logger.warn('[TEST_SUBMIT_RETRY_EMPTY_CACHED_RESULT]', {
        sessionId,
        studentId: user.id,
      });
    } else {
      logger.info('[TEST_SUBMIT_IDEMPOTENT]', { sessionId, studentId: user.id });
      res = NextResponse.json({
        score: cached.score,
        percentage: Math.round(cached.score * 100),
        correctAnswers: cached.correctAnswers,
        totalAnswers: cached.totalAnswers,
        results: cached.answers,
        nextPhase: 'HOMEWORK',
      });
      logger.logAPI(req, res, { className: 'TestSubmitAPI', methodName: 'POST' }, start);
      return res;
    }
  }

  // ── Phase guard ───────────────────────────────────────────────────────────
  if (session.state !== 'TEST') {
    res = NextResponse.json(
      {
        error: 'Test can only be submitted while the session is in the TEST phase',
        currentPhase: session.state,
      },
      { status: 409 },
    );
    logger.logAPI(req, res, { className: 'TestSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Load served test questions from the Question bank ───────────────────
  const servedTestIds = Array.isArray(sessionMeta.servedTestIds)
    ? (sessionMeta.servedTestIds as string[])
    : [];
  const answerIds = body.answers.map((answer) => answer.questionId);
  const requestedIds = servedTestIds.length > 0 ? servedTestIds : answerIds;

  const testQuestions = await prisma.question.findMany({
    where: {
      id: { in: requestedIds },
      topicId: session.topicId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      type: true,
      choices: true,
      correctAnswer: true,
    },
  });

  if (testQuestions.length === 0) {
    res = NextResponse.json(
      { error: 'No test questions available for this topic' },
      { status: 404 },
    );
    logger.logAPI(req, res, { className: 'TestSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const questionMap = new Map<string, TestQuestionForGrading>(
    testQuestions.map((q) => [q.id, q]),
  );

  // ── Grade answers ─────────────────────────────────────────────────────────

  let correctCount = 0;
  let totalCount = 0;
  const gradedAnswers: GradedAnswer[] = [];

  for (const ans of body.answers) {
    const question = questionMap.get(ans.questionId);
    if (!question) continue;

    totalCount++;
    const correctAnswerStr = question.correctAnswer;
    const isCorrect = gradeTestQuestion(question, ans.answer, correctAnswerStr);
    if (isCorrect) correctCount++;

    gradedAnswers.push({
      questionId: ans.questionId,
      studentAnswer: ans.answer,
      isCorrect,
      correctAnswer: correctAnswerStr,
    });
  }

  const score = totalCount > 0 ? correctCount / totalCount : 0;

  const testResult: TestResult = {
    score,
    correctAnswers: correctCount,
    totalAnswers: totalCount,
    gradedAt: new Date().toISOString(),
    answers: gradedAnswers.map((ga) => ({
      questionId: ga.questionId,
      isCorrect: ga.isCorrect,
      correctAnswer: ga.correctAnswer,
    })),
  };

  await prisma.structuredSession.update({
    where: { id: session.id },
    data: {
      meta: {
        ...sessionMeta,
        testResult,
      },
    },
  });

  logger.info('[TEST_SUBMITTED]', {
    sessionId,
    studentId: user.id,
    topicId: session.topicId,
    totalAnswers: totalCount,
    correctAnswers: correctCount,
    score,
  });

  await emitServerAnalyticsEvent(
    {
      eventType: ANALYTICS_EVENTS.STUDENT.QUIZ_ATTEMPTED,
      userId: user.id,
      courseId: session.topicId,
      metadata: {
        sessionId,
        topicId: session.topicId,
        totalAnswers: totalCount,
        correctAnswers: correctCount,
        score,
      },
    },
    'session.test.submit',
  );

  if (score >= QUIZ_PASSING_SCORE) {
    await emitServerAnalyticsEvent(
      {
        eventType: ANALYTICS_EVENTS.STUDENT.QUIZ_PASSED,
        userId: user.id,
        courseId: session.topicId,
        metadata: {
          sessionId,
          topicId: session.topicId,
          totalAnswers: totalCount,
          correctAnswers: correctCount,
          score,
          passingScore: QUIZ_PASSING_SCORE,
        },
      },
      'session.test.submit.pass',
    );
  }

  // ── Update topic mastery (weight 0.3) -- fire-and-forget ────────────────────
  if (totalCount > 0) {
    updateStudentTopicProgress({
      studentId: user.id,
      topicId: session.topicId,
      correctAnswers: correctCount,
      totalAnswers: totalCount,
      activityType: 'TEST',
    }).catch((err) =>
      logger.error('[TEST_PROGRESS_UPDATE_FAILED]', {
        sessionId,
        studentId: user.id,
        topicId: session.topicId,
        error: err,
      }),
    );
  }

  // ── Session events -- fire-and-forget ─────────────────────────────────────
  if (gradedAnswers.length > 0) {
    recordSessionEvents(
      gradedAnswers.map((ga) => ({
        sessionId,
        eventType: 'QUESTION_ANSWERED' as const,
        metadata: {
          studentId: user.id,
          questionId: ga.questionId,
          isCorrect: ga.isCorrect,
          source: 'test',
        },
      })),
    );
  }

  res = NextResponse.json({
    score,
    percentage: Math.round(score * 100),
    correctAnswers: correctCount,
    totalAnswers: totalCount,
    results: gradedAnswers.map((ga) => ({
      questionId: ga.questionId,
      isCorrect: ga.isCorrect,
      correctAnswer: ga.correctAnswer,
    })),
    nextPhase: 'HOMEWORK',
  });

  logger.logAPI(req, res, { className: 'TestSubmitAPI', methodName: 'POST' }, start);
  return res;
}

// ─── Grading Helpers ────────────────────────────────────────────────────────

function gradeTestQuestion(
  question: TestQuestionForGrading,
  studentAnswer: string,
  correctAnswerStr: string | null,
): boolean {
  if (!correctAnswerStr) return false;

  const type = (question.type || '').toLowerCase();
  const options = normalizeOptions(question.choices);

  if (type === 'mcq' || type === 'multiple_choice') {
    return gradeMCQ(options, correctAnswerStr, studentAnswer);
  }

  return normalizeAnswer(studentAnswer) === normalizeAnswer(correctAnswerStr);
}

function normalizeOptions(opts: unknown): string[] {
  if (!opts) return [];
  if (Array.isArray(opts)) {
    return opts.map((o) => (typeof o === 'string' ? o : String(o)));
  }
  if (typeof opts === 'object' && opts !== null) {
    return Object.values(opts).map((v) => (typeof v === 'string' ? v : String(v)));
  }
  return [];
}

function gradeMCQ(options: string[], correctAnswer: string, studentAnswer: string): boolean {
  const correct = normalizeAnswer(correctAnswer);
  const student = normalizeAnswer(studentAnswer);

  if (student === correct) return true;

  // Student answered with letter key (a/b/c/d) → map to option text
  const letterIdx = student.charCodeAt(0) - 'a'.charCodeAt(0);
  if (letterIdx >= 0 && letterIdx < options.length) {
    const optionText = normalizeAnswer(options[letterIdx]);
    if (optionText === correct) return true;
  }

  // Correct answer is a letter key → map to option text for comparison
  const correctIdx = correct.charCodeAt(0) - 'a'.charCodeAt(0);
  if (correctIdx >= 0 && correctIdx < options.length) {
    const correctText = normalizeAnswer(options[correctIdx]);
    if (student === correctText) return true;
  }

  return false;
}
