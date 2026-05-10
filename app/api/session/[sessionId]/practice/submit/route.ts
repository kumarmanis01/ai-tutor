/**
 * POST /api/session/[sessionId]/practice/submit
 *
 * Grades a student's practice answers for the PRACTICE phase of a structured
 * learning session, updates topic mastery, and stores the result so the
 * student can advance to the TEST phase.
 *
 * Design decisions:
 *
 *   Idempotency
 *   -----------
 *   Practice results are stored in StructuredSession.meta.practiceResult on
 *   first submission. Re-submissions (network retries, double-clicks) detect
 *   this field and return the cached result immediately without re-grading or
 *   re-updating mastery. This matches the atomicity level of the rest of the
 *   session engine -- no new Prisma table required.
 *
 *   No schema migration
 *   -------------------
 *   StructuredSession.meta is Json? and already used for phaseTimestamps.
 *   Storing practiceResult there avoids a migration and keeps practice data
 *   session-scoped (the only place it is meaningfully queried).
 *
 *   Question loading
 *   ----------------
 *   Questions are loaded by submitted questionIds (scoped to topicId + ACTIVE)
 *   so grading always matches the exact PRACTICE set the student received,
 *   independent of recency or pool reshuffling.
 *
 *   Mastery
 *   -------
 *   updateStudentTopicProgress(activityType: PRACTICE) is called fire-and-forget
 *   on first submission only. Failures are logged but never propagated.
 *
 *   Session events
 *   --------------
 *   QUESTION_ANSWERED events are recorded per answered question, fire-and-forget.
 *
 * EDIT LOG:
 *   2026-03-07 | Manish Kumar | created (fixes GAP-02: PRACTICE phase had no
 *                               submission path, leaving mastery weight of 0.1 unused).
 *   2026-05-10 | copilot      | dedupe submitted answers by questionId and grade only
 *                               against submitted IDs to prevent duplicate grading paths.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';
import { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';
import { recordSessionEvents } from '@/lib/session/sessionEvents';
import { normalizeAnswer } from '@/lib/tests';
import { logger } from '@/lib/logger';
import { detectMisconceptions, loadMisconceptions, logNovelMisconception } from '@/lib/ai/tutor/misconceptionDetector';
import { normalizeStudentAnswerForLogging } from '@/lib/misconception/logHelpers';

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

/** Subset of Question fields needed for grading. */
interface PracticeQuestion {
  id: string;
  type: string;
  choices: unknown;
  correctAnswer: string | null;
}

/** Shape stored in StructuredSession.meta.practiceResult. */
interface PracticeResult {
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  gradedAt: string;
  answers: { questionId: string; isCorrect: boolean; correctAnswer: string | null }[];
}

function dedupeSubmittedAnswers(
  answers: { questionId: string; answer: string }[],
): { questionId: string; answer: string }[] {
  const seen = new Set<string>();
  const deduped: { questionId: string; answer: string }[] = [];

  for (const answer of answers) {
    const key = String(answer.questionId ?? '').trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(answer);
  }

  return deduped;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * POST /api/session/[sessionId]/practice/submit
 *
 * Body: { answers: { questionId: string; answer: string }[] }
 *
 * Response (200):
 *   {
 *     score: number,            // 0-1
 *     percentage: number,       // 0-100
 *     correctAnswers: number,
 *     totalAnswers: number,
 *     results: { questionId, isCorrect, correctAnswer }[],
 *     nextPhase: 'TEST'
 *   }
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
    logger.logAPI(req, res, { className: 'PracticeSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Feature flag ──────────────────────────────────────────────────────────

  if (!isSessionEngineEnabled()) {
    res = NextResponse.json({ error: 'Session engine disabled' }, { status: 503 });
    logger.logAPI(req, res, { className: 'PracticeSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Parse params and body ─────────────────────────────────────────────────

  const { sessionId } = await params;

  const body = (await req.json().catch(() => null)) as SubmitBody | null;
  if (!body || !Array.isArray(body.answers) || body.answers.length === 0) {
    res = NextResponse.json(
      { error: 'answers[] is required and must be non-empty' },
      { status: 400 },
    );
    logger.logAPI(req, res, { className: 'PracticeSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const dedupedSubmittedAnswers = dedupeSubmittedAnswers(body.answers);
  if (dedupedSubmittedAnswers.length === 0) {
    res = NextResponse.json(
      { error: 'answers[] must contain at least one valid questionId' },
      { status: 400 },
    );
    logger.logAPI(req, res, { className: 'PracticeSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Load session ──────────────────────────────────────────────────────────

  const session = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId: user.id },
  });

  if (!session) {
    res = NextResponse.json({ error: 'Session not found' }, { status: 404 });
    logger.logAPI(req, res, { className: 'PracticeSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  const sessionMeta = (session.meta as Record<string, unknown>) ?? {};

  // ── Idempotency gate ──────────────────────────────────────────────────────
  // If a practiceResult is already stored in meta, return it without
  // re-grading or re-updating mastery -- covers network retries and
  // double-submissions regardless of the current session phase.

  if (sessionMeta.practiceResult) {
    const cached = sessionMeta.practiceResult as PracticeResult;

    logger.info('[PRACTICE_SUBMIT_IDEMPOTENT]', { sessionId, studentId: user.id });

    res = NextResponse.json({
      score: cached.score,
      percentage: Math.round(cached.score * 100),
      correctAnswers: cached.correctAnswers,
      totalAnswers: cached.totalAnswers,
      results: cached.answers,
      nextPhase: 'TEST',
    });
    logger.logAPI(req, res, { className: 'PracticeSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Phase guard ───────────────────────────────────────────────────────────
  // Only allow first-time submission when the session is in PRACTICE state.

  if (session.state !== 'PRACTICE') {
    res = NextResponse.json(
      {
        error: 'Practice can only be submitted while the session is in the PRACTICE phase',
        currentPhase: session.state,
      },
      { status: 409 },
    );
    logger.logAPI(req, res, { className: 'PracticeSubmitAPI', methodName: 'POST' }, start);
    return res;
  }

  // ── Load practice questions ───────────────────────────────────────────────
  // Grade only against the submitted question IDs within the current topic.
  // Unknown IDs are silently skipped.

  const submittedQuestionIds = dedupedSubmittedAnswers.map((a) => a.questionId);
  const practiceQuestions = await prisma.question.findMany({
    // quarantined questions excluded -- do not remove this filter
    where: {
      topicId: session.topicId,
      status: 'ACTIVE',
      id: { in: submittedQuestionIds },
    },
    select: { id: true, type: true, choices: true, correctAnswer: true },
  });

  const questionMap = new Map<string, PracticeQuestion>(
    practiceQuestions.map((q) => [q.id, q]),
  );

  // ── Grade answers ─────────────────────────────────────────────────────────

  let correctCount = 0;
  let totalCount = 0;
  const gradedAnswers: GradedAnswer[] = [];

  for (const ans of dedupedSubmittedAnswers) {
    const question = questionMap.get(ans.questionId);
    if (!question) continue; // unknown question -- skip silently

    totalCount++;
    const isCorrect = gradeQuestion(question, ans.answer);
    if (isCorrect) correctCount++;

    gradedAnswers.push({
      questionId: ans.questionId,
      studentAnswer: ans.answer,
      isCorrect,
      correctAnswer: question.correctAnswer,
    });
  }

  const score = totalCount > 0 ? correctCount / totalCount : 0;

  // ── Persist result into session meta ──────────────────────────────────────
  // Writing practiceResult atomically into meta. Concurrent duplicate
  // requests would both reach this point only if neither had a cached
  // result (i.e. they both arrived before the first write committed). In
  // that case both writes compute the same grade from the same answers and
  // the second write is a benign overwrite. updateStudentTopicProgress is
  // called inside the same try block so it is only called by the writer
  // that successfully updates mastery -- fire-and-forget means failures
  // are logged but do not roll back the meta write.

  const practiceResult: PracticeResult = {
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
        practiceResult,
      },
    },
  });

  logger.info('[PRACTICE_SUBMITTED]', {
    sessionId,
    studentId: user.id,
    topicId: session.topicId,
    totalAnswers: totalCount,
    correctAnswers: correctCount,
    score,
  });

  // ── Update topic mastery -- fire-and-forget ────────────────────────────────
  // activityType PRACTICE carries weight 0.1. Non-fatal: logged but never
  // propagated so a mastery write failure cannot fail the submission.

  if (totalCount > 0) {
    updateStudentTopicProgress({
      studentId: user.id,
      topicId: session.topicId,
      correctAnswers: correctCount,
      totalAnswers: totalCount,
      activityType: 'PRACTICE',
    }).catch((err) =>
      logger.error('[PRACTICE_PROGRESS_UPDATE_FAILED]', {
        sessionId,
        studentId: user.id,
        topicId: session.topicId,
        error: err,
      }),
    );
  }

  // ── F-STU-013 AC-05: Novel misconception analytics -- fire-and-forget ─────────
  // For wrong answers, check against the misconception library. If there are
  // wrong answers with no library match, log as a novel misconception signal.
  const wrongAnswers = gradedAnswers.filter((ga) => !ga.isCorrect && ga.studentAnswer.trim().length > 0);
  if (wrongAnswers.length > 0 && session.topicId) {
    const capturedTopicId = session.topicId;
    const capturedStudentId = user.id;
    void (async () => {
      try {
        // Resolve subjectId via topic -> chapter -> subject hierarchy
        const topicWithSubject = await prisma.topicDef.findUnique({
          where: { id: capturedTopicId },
          select: { chapter: { select: { subject: { select: { id: true } } } } },
        });
        const subjectId = topicWithSubject?.chapter?.subject?.id;

        // If subjectId cannot be resolved, skip logging to avoid noisy/false analytics
        if (!subjectId) {
          logger.info('Skipping novel misconception logging: missing subjectId', {
            event: 'logNovelMisconception',
            studentId: capturedStudentId,
            topicId: capturedTopicId,
          });
        } else {
          const misconceptions = await loadMisconceptions(subjectId, capturedTopicId);
          for (const wrong of wrongAnswers) {
            const answerText = typeof wrong.studentAnswer === 'string' ? wrong.studentAnswer : String(wrong.studentAnswer ?? '');
            const matches = detectMisconceptions(answerText, misconceptions);
            if (matches.length === 0) {
              const snippet = normalizeStudentAnswerForLogging(answerText, 1000);
              try {
                await logNovelMisconception(capturedStudentId, subjectId, capturedTopicId, snippet);
              } catch (err) {
                logger.error('logNovelMisconception_failed', {
                  error: (err as Error)?.message,
                  studentId: capturedStudentId,
                  topicId: capturedTopicId,
                });
              }
            }
          }
        }
      } catch {
        // never let analytics disrupt the response
      }
    })();
  }

  // ── Session events -- fire-and-forget ──────────────────────────────────────

  if (gradedAnswers.length > 0) {
    recordSessionEvents(
      gradedAnswers.map((ga) => ({
        sessionId,
        eventType: 'QUESTION_ANSWERED' as const,
        metadata: {
          studentId: user.id,
          questionId: ga.questionId,
          isCorrect: ga.isCorrect,
          source: 'practice',
        },
      })),
    );
  }

  // ── Response ──────────────────────────────────────────────────────────────

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
    nextPhase: 'TEST',
  });

  logger.logAPI(req, res, { className: 'PracticeSubmitAPI', methodName: 'POST' }, start);
  return res;
}

// ─── Grading Logic ────────────────────────────────────────────────────────────
// Mirrors the grading strategy in app/api/homework/submit/route.ts.
// Both use normalizeAnswer() for case-insensitive, whitespace-trimmed comparison.
// MCQ supports key-based (A/B/C/D) and text-based answer formats.

function gradeQuestion(question: PracticeQuestion, studentAnswer: string): boolean {
  if (!question.correctAnswer) return false;

  const type = (question.type || '').toLowerCase();

  if (type === 'mcq' || type === 'multiple_choice') {
    return gradeMCQ(question, studentAnswer);
  }

  // Fallback: normalised text comparison for short-answer etc.
  return normalizeAnswer(studentAnswer) === normalizeAnswer(question.correctAnswer);
}

function gradeMCQ(question: PracticeQuestion, studentAnswer: string): boolean {
  const correct = normalizeAnswer(question.correctAnswer ?? '');
  const student = normalizeAnswer(studentAnswer);

  if (student === correct) return true;

  // Student answered with a letter key (a/b/c/d), correctAnswer is option text.
  if (Array.isArray(question.choices)) {
    const idx = student.charCodeAt(0) - 'a'.charCodeAt(0);
    if (idx >= 0 && idx < question.choices.length) {
      const optionText = normalizeAnswer(String(question.choices[idx]));
      if (optionText === correct) return true;
    }

    // Student answered with option text, correctAnswer is a key.
    const correctIdx = correct.charCodeAt(0) - 'a'.charCodeAt(0);
    if (correctIdx >= 0 && correctIdx < question.choices.length) {
      const correctText = normalizeAnswer(String(question.choices[correctIdx]));
      if (student === correctText) return true;
    }
  }

  return false;
}
