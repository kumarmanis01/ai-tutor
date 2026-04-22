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
 * Auth: session required -- 401 if missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { clearPartialDiagnostic } from '@/lib/redis/diagnosticPartial';
import { enqueueDiagnosticBootstrapJob } from '@/jobs/diagnosticBootstrap';
import { upsertSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore';
import { getSession } from '@/lib/diagnostics/sessionStore';
import { computeSessionTheta } from '@/lib/diagnostics/selector';
import { thetaToPlacement } from '@/lib/irt/irt';
import { cancelDiagnosticAutoSubmit } from '@/jobs/diagnosticAutoSubmit';
import { diagnosticConfig } from '@/lib/config';
import { getAnalyticsQueue } from '@/lib/queues/analyticsQueue';

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

    // Unique diagnosticSessionId for this run.
    // Also check for an existing adaptive session id passed in the body.
    const incomingSessionId: string | undefined =
      typeof body.sessionId === 'string' ? body.sessionId : undefined;
    const diagnosticSessionId =
      incomingSessionId ?? `diagnostic:${userId}:${subjectId}:${Date.now()}`;

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

    // Rapid-fire gaming detection (AC-08): flag sessions where >30% of answers were too fast.
    const rapidFireCount = answers.filter(
      (a) => typeof a.timeSpentMs === 'number' && a.timeSpentMs < diagnosticConfig.rapidFireThresholdMs,
    ).length;
    const gamingFlag =
      answers.length > 0 &&
      rapidFireCount / answers.length > diagnosticConfig.rapidFireRatioThreshold;
    if (gamingFlag) {
      logger.warn('DiagnosticSubmitAPI: rapid-fire gaming flag', {
        className: 'DiagnosticSubmitAPI',
        methodName: 'POST',
        userId,
        subjectId,
        rapidFireCount,
        totalAnswers: answers.length,
      });
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

    // Clear Redis partial state and cancel any pending auto-submit job.
    await clearPartialDiagnostic(userId, subjectId);
    await cancelDiagnosticAutoSubmit(userId, subjectId);

    // Transition diagnostic status to completed so the mandatory gate unlocks.
    // Persist gamingFlagged so the admin layer can surface flagged sessions
    // without re-scanning AnswerEvent rows.
    await upsertSubjectDiagnosticStatus(userId, subjectId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      runId: diagnosticSessionId,
      gamingFlagged: gamingFlag || undefined,
    });

    // Compute grade-level placement (AC-05) from adaptive session theta when available.
    // Falls back to neutral ('at') when no Redis session exists (non-adaptive submit).
    let placement: 'below' | 'at' | 'above' = 'at';
    try {
      if (incomingSessionId) {
        const adaptiveSession = await getSession(incomingSessionId);
        if (adaptiveSession) {
          const { theta } = await computeSessionTheta(adaptiveSession);
          placement = thetaToPlacement(theta);
        }
      }
    } catch {
      // non-fatal: placement defaults to 'at'
    }

    // Analytics: emit `diagnostic_completed` (best-effort)
    try {
      // Prefer authoritative totalQuestions from adaptive session when present
      let totalQuestions = answers.length;
      if (incomingSessionId) {
        try {
          const s = await getSession(incomingSessionId);
          if (s?.candidateQuestionIds && Array.isArray(s.candidateQuestionIds)) {
            totalQuestions = s.candidateQuestionIds.length;
          }
        } catch (sessErr) {
          logger.warn('diagnostic.submit: failed to load session for analytics totalQuestions', {
            className: 'DiagnosticSubmitAPI',
            methodName: 'POST',
            error: String(sessErr),
          });
        }
      }

      const answeredCount = answerEventData.length;
      const correctCount = answerEventData.filter((a) => !!a.isCorrect).length;
      const metadata = {
        subjectId,
        sessionId: diagnosticSessionId,
        totalQuestions,
        answeredCount,
        correctCount,
        gamingFlag: !!gamingFlag,
        placement,
      } as const;

      const analyticsEventData = {
        eventType: 'diagnostic_completed',
        userId,
        courseId: null,
        lessonIdx: null,
        metadata,
      } as const;

      const analyticsQueue = getAnalyticsQueue();
      if (analyticsQueue) {
        try {
          await analyticsQueue.add('analytics.ingest', analyticsEventData);
        } catch (enqueueErr) {
          logger.warn('diagnostic.submit: analytics enqueue failed; falling back to direct DB write', {
            className: 'DiagnosticSubmitAPI',
            methodName: 'POST',
            error: String(enqueueErr),
          });
          try {
            await prisma.analyticsEvent.create({ data: analyticsEventData });
          } catch (dbErr) {
            logger.warn('diagnostic.submit: analytics fallback DB write failed', {
              className: 'DiagnosticSubmitAPI',
              methodName: 'POST',
              error: String(dbErr),
            });
          }
        }
      } else {
        try {
          await prisma.analyticsEvent.create({ data: analyticsEventData });
        } catch (dbErr) {
          logger.warn('diagnostic.submit: analytics DB write failed', {
            className: 'DiagnosticSubmitAPI',
            methodName: 'POST',
            error: String(dbErr),
          });
        }
      }
    } catch (analyticsErr) {
      logger.warn('diagnostic.submit: analytics emit failed', {
        className: 'DiagnosticSubmitAPI',
        methodName: 'POST',
        error: String(analyticsErr),
      });
    }

    const res = NextResponse.json({ success: true, subjectId, placement });
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
