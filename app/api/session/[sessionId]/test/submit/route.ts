/**
 * POST /api/session/[sessionId]/test/submit
 *
 * Grades a student's test answers for the TEST phase of a structured
 * learning session, updates topic mastery (weight 0.3), and stores the
 * result so the student can advance to the HOMEWORK phase.
 *
 * Design decisions:
 *
 *   Idempotency
 *   -----------
 *   Test results are stored in StructuredSession.meta.testResult on
 *   first submission. Re-submissions (network retries, double-clicks)
 *   detect this field and return the cached result immediately without
 *   re-grading or re-updating mastery. Mirrors practice submit (GAP-02).
 *
 *   No schema migration
 *   -------------------
 *   StructuredSession.meta is Json? and already used for practiceResult
 *   and phaseTimestamps. Storing testResult there avoids a migration.
 *
 *   Mastery
 *   -------
 *   updateStudentTopicProgress(activityType: TEST) carries weight 0.3.
 *   Fire-and-forget: failures are logged but never propagated.
 *
 * EDIT LOG:
 *   2026-03-07 | Manish Kumar | created (GAP-02 second half: TEST phase
 *                               submission path, enables mastery weight 0.3).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';
import { recordSessionEvents } from '@/lib/session/sessionEvents';
import { normalizeAnswer } from '@/lib/tests';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmitBody {
  answers: { questionId: string; answer: string }[];
}

interface GradedAnswer {
  questionId: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string | null;
}

/** Subset of GeneratedQuestion fields needed for grading. */
interface TestQuestionForGrading {
  id: string;
  type: string;
  options: unknown;
  answer: unknown;
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

  // ── Load test questions (same source as resolveTest, include answer) ─────
  const questionSelect = {
    select: { id: true, type: true, options: true, answer: true },
  };

  let test = await prisma.generatedTest.findFirst({
    where: { topicId: session.topicId, lifecycle: 'active', status: 'approved' },
    orderBy: [{ version: 'desc' }],
    include: { questions: questionSelect },
  });

  if (!test || test.questions.length === 0) {
    test = await prisma.generatedTest.findFirst({
      where: { topicId: session.topicId, lifecycle: 'active' },
      orderBy: [{ version: 'desc' }],
      include: { questions: questionSelect },
    });
  }

  if (!test || test.questions.length === 0) {
    res = NextResponse.json(
      { error: 'No test questions available for this topic' },
      { status: 404 },
    );
    logger.logAPI(req, res, { className: 'TestSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const questionMap = new Map<string, TestQuestionForGrading>(
    test.questions.map((q) => [q.id, q]),
  );

  // ── Grade answers ─────────────────────────────────────────────────────────

  let correctCount = 0;
  let totalCount = 0;
  const gradedAnswers: GradedAnswer[] = [];

  for (const ans of body.answers) {
    const question = questionMap.get(ans.questionId);
    if (!question) continue;

    totalCount++;
    const correctAnswerStr = extractCorrectAnswer(question.answer);
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

function extractCorrectAnswer(answer: unknown): string | null {
  if (answer == null) return null;
  if (typeof answer === 'string') return answer;
  if (typeof answer === 'number') return String(answer);
  if (Array.isArray(answer) && answer.length > 0) {
    const first = answer[0];
    return typeof first === 'string' ? first : JSON.stringify(first);
  }
  return JSON.stringify(answer);
}

function gradeTestQuestion(
  question: TestQuestionForGrading,
  studentAnswer: string,
  correctAnswerStr: string | null,
): boolean {
  if (!correctAnswerStr) return false;

  const type = (question.type || '').toLowerCase();
  const options = normalizeOptions(question.options);

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
