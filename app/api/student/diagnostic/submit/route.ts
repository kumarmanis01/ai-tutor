/**
 * POST /api/student/diagnostic/submit
 *
 * Receives diagnostic answers, persists AnswerEvent rows, enqueues
 * diagnosticBootstrapWorker to seed StudentConceptState + generate LearningPlan,
 * and clears the Redis partial state.
 *
 * Body: {
 *   subjectId: string,
 *   answers: Array<{ questionId: string, selectedOption: string, timeSpentMs: number }>
 * }
 *
 * Returns: { success: true, subjectId }
 * Auth: session required — 401 if missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { clearPartialDiagnostic } from '@/lib/redis/diagnosticPartial';
import { enqueueDiagnosticBootstrapJob } from '@/jobs/diagnosticBootstrap';

interface AnswerInput {
  questionId: string;
  selectedOption: string;
  timeSpentMs: number;
}

/**
 * Check if a selected option is correct.
 * Handles correctAnswer = full option text or numeric index string.
 */
function isAnswerCorrect(
  correctAnswer: string,
  choices: unknown,
  selectedOption: string,
): boolean {
  if (correctAnswer === selectedOption) return true;
  // Numeric index fallback
  const idx = parseInt(correctAnswer, 10);
  if (!isNaN(idx) && Array.isArray(choices) && idx >= 0 && idx < choices.length) {
    return String(choices[idx]) === selectedOption;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'DiagnosticSubmitAPI', methodName: 'POST' }, start);
      return res;
    }

    const body = await req.json().catch(() => ({}));
    const subjectId: string = typeof body.subjectId === 'string' ? body.subjectId : '';
    const rawAnswers: unknown[] = Array.isArray(body.answers) ? body.answers : [];

    if (!subjectId) {
      return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
    }
    if (rawAnswers.length === 0) {
      return NextResponse.json({ error: 'answers array is required' }, { status: 400 });
    }

    // Validate and normalise input answers
    const answers: AnswerInput[] = rawAnswers
      .filter(
        (a): a is Record<string, unknown> =>
          !!a && typeof a === 'object' && typeof (a as Record<string, unknown>).questionId === 'string',
      )
      .map((a) => ({
        questionId: String(a.questionId),
        selectedOption: String(a.selectedOption ?? ''),
        timeSpentMs: Number(a.timeSpentMs) || 0,
      }));

    if (answers.length === 0) {
      return NextResponse.json({ error: 'No valid answers provided' }, { status: 400 });
    }

    // Fetch questions to check correctness and resolve topicId → conceptId
    const questionIds = answers.map((a) => a.questionId);
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, correctAnswer: true, choices: true, topicId: true },
    });

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Resolve topicId → first conceptId for AnswerEvent
    const topicIds = [
      ...new Set(questions.map((q) => q.topicId).filter((t): t is string => !!t)),
    ];
    const concepts =
      topicIds.length > 0
        ? await prisma.concept.findMany({
            where: { topicId: { in: topicIds } },
            select: { id: true, topicId: true },
            orderBy: { createdAt: 'asc' },
          })
        : [];

    // Map topicId → first conceptId
    const topicToConceptId = new Map<string, string>();
    for (const c of concepts) {
      if (!topicToConceptId.has(c.topicId)) {
        topicToConceptId.set(c.topicId, c.id);
      }
    }

    // Resolve chapterIds for bootstrap job (unique chapters across all questions)
    const questionTopicIds = [
      ...new Set(questions.map((q) => q.topicId).filter((t): t is string => !!t)),
    ];
    const topics =
      questionTopicIds.length > 0
        ? await prisma.topicDef.findMany({
            where: { id: { in: questionTopicIds } },
            select: { id: true, chapterId: true },
          })
        : [];

    const chapterIds = [...new Set(topics.map((t) => t.chapterId))];

    // Look up subject board/grade for bootstrap job data
    const subject = await prisma.subjectDef.findUnique({
      where: { id: subjectId },
      select: { class: { select: { id: true } } },
    });

    // Unique diagnosticSessionId for this run
    const diagnosticSessionId = `diagnostic:${userId}:${subjectId}:${Date.now()}`;

    // Create AnswerEvent rows for each answer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { board: true },
    });
    const boardId = user?.board ?? '';
    const gradeId = subject?.class?.id ?? '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const answerEventData: any[] = [];
    for (const answer of answers) {
      const q = questionMap.get(answer.questionId);
      if (!q) continue;

      const conceptId = q.topicId ? topicToConceptId.get(q.topicId) : undefined;
      if (!conceptId) continue; // skip if no concept mapped

      const correct = isAnswerCorrect(
        q.correctAnswer ?? '',
        q.choices,
        answer.selectedOption,
      );

      answerEventData.push({
        studentId: userId,
        sessionId: diagnosticSessionId,
        conceptId,
        questionId: answer.questionId,
        isCorrect: correct,
        studentAnswer: answer.selectedOption,
        source: 'diagnostic',
      });
    }

    if (answerEventData.length > 0) {
      await prisma.answerEvent.createMany({ data: answerEventData });
    }

    // Enqueue bootstrap worker to seed StudentConceptState + generate LearningPlan
    if (chapterIds.length > 0) {
      try {
        await enqueueDiagnosticBootstrapJob({
          studentId: userId,
          diagnosticSessionId,
          chapterIds,
          boardId,
          gradeId,
        });
      } catch (enqueueErr) {
        // Non-fatal: log and continue
        logger.warn('DiagnosticSubmitAPI: failed to enqueue bootstrap job', {
          className: 'DiagnosticSubmitAPI',
          methodName: 'POST',
          studentId: userId,
          subjectId,
          error: String(enqueueErr),
        });
      }
    }

    // Clear Redis partial state
    await clearPartialDiagnostic(userId, subjectId);

    const res = NextResponse.json({ success: true, subjectId });
    logger.logAPI(req, res, { className: 'DiagnosticSubmitAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('DiagnosticSubmitAPI error', {
      className: 'DiagnosticSubmitAPI',
      methodName: 'POST',
      error: err,
    });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
