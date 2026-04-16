import type { Job } from 'bullmq';
import { prisma } from '@/lib/prisma.js';
import { logger } from '@/lib/logger.js';
import { getPartialDiagnostic, clearPartialDiagnostic } from '@/lib/redis/diagnosticPartial.js';
import { enqueueDiagnosticBootstrapJob } from '@/jobs/diagnosticBootstrap.js';
import { upsertSubjectDiagnosticStatus } from '@/lib/diagnostics/stateStore.js';
import { diagnosticConfig } from '@/lib/config';
import type { DiagnosticAutoSubmitJobData } from '@/jobs/diagnosticAutoSubmit.js';

/**
 * Processes a delayed auto-submit job (AC-04: "After 24h the partial diagnostic is auto-submitted").
 * Idempotent: if the diagnostic is already completed or no partial state exists, exits cleanly.
 */
export async function processDiagnosticAutoSubmit(
  job: Job<DiagnosticAutoSubmitJobData>,
): Promise<void> {
  const { userId, subjectId, sessionId } = job.data;

  if (!userId || !subjectId) {
    logger.warn('[diagnostic-auto-submit] invalid job data', { jobId: job.id });
    return;
  }

  logger.info('[diagnostic-auto-submit] processing', { userId, subjectId });

  try {
    // Guard: if already completed, skip.
    const { getSubjectDiagnosticStatus } = await import('@/lib/diagnostics/stateStore.js');
    const currentStatus = await getSubjectDiagnosticStatus(userId, subjectId);
    if (currentStatus.status === 'completed') {
      logger.info('[diagnostic-auto-submit] already completed, skipping', { userId, subjectId });
      return;
    }

    // Read partial answers from Redis.
    const partial = await getPartialDiagnostic(userId, subjectId);
    if (!partial || partial.answers.length === 0) {
      logger.info('[diagnostic-auto-submit] no partial state found, nothing to submit', { userId, subjectId });
      return;
    }

    const questionIds = partial.answers.map((a) => a.questionId).filter(Boolean);

    // Determine whether this is a partial/abandoned run (fewer than min valid answers).
    const providedAnswersCount = partial.answers.length;
    const minValid = Number(diagnosticConfig.minAnswersForValidity ?? 10);
    const isPartialAbandon = providedAnswersCount < minValid;

    // Fetch questions for grading and concept resolution.
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, correctAnswer: true, choices: true, topicId: true },
    });
    const questionMap = new Map<string, typeof questions[number]>(questions.map((q) => [q.id, q]));

    // Resolve topicId -> conceptId.
    const topicIds = [...new Set(questions.map((q) => q.topicId).filter((t): t is string => !!t))];
    const concepts =
      topicIds.length > 0
        ? await prisma.concept.findMany({
            where: { topicId: { in: topicIds } },
            select: { id: true, topicId: true },
            orderBy: { createdAt: 'asc' },
          })
        : [];
    const topicToConceptId = new Map<string, string>();
    for (const c of concepts) {
      if (!topicToConceptId.has(c.topicId)) topicToConceptId.set(c.topicId, c.id);
    }

    const diagnosticSessionId =
      sessionId ?? `diagnostic-auto:${userId}:${subjectId}:${Date.now()}`;

    // Write AnswerEvents.
    const answerEventData: object[] = [];
    for (const answer of partial.answers) {
      const q = questionMap.get(answer.questionId);
      if (!q) continue;
      const conceptId = q.topicId ? topicToConceptId.get(q.topicId) : undefined;
      if (!conceptId) continue;

      const correct = q.correctAnswer === answer.selectedOption;
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
      await prisma.answerEvent.createMany({ data: answerEventData as any[] });
    }

    // Resolve chapter ids for bootstrap.
    let chapterIds: string[] = [];
    if (isPartialAbandon) {
      // AC-07: when diagnostic is a partial/abandon (< min valid answers), assume
      // grade-level start for unanswered chapters. Enqueue bootstrap for ALL
      // chapters in the subject so unanswered concepts are seeded with grade-level defaults.
      const allChapters = await prisma.chapterDef.findMany({ where: { subjectId }, select: { id: true } });
      chapterIds = allChapters.map((c) => c.id);
    } else {
      const questionTopicIds = [...new Set(questions.map((q) => q.topicId).filter((t): t is string => !!t))];
      const topics: { id: string; chapterId: string }[] =
        questionTopicIds.length > 0
          ? await prisma.topicDef.findMany({
              where: { id: { in: questionTopicIds } },
              select: { id: true, chapterId: true },
            })
          : [];
      chapterIds = [...new Set(topics.map((t) => t.chapterId))];
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { board: true },
    });
    const subject = await prisma.subjectDef.findUnique({
      where: { id: subjectId },
      select: { class: { select: { id: true } } },
    });

    if (chapterIds.length > 0) {
      await enqueueDiagnosticBootstrapJob({
        studentId: userId,
        diagnosticSessionId,
        chapterIds,
        boardId: user?.board ?? '',
        gradeId: subject?.class?.id ?? '',
      });
    }

    // Mark completed and clean up.
    await clearPartialDiagnostic(userId, subjectId);
    await upsertSubjectDiagnosticStatus(userId, subjectId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      runId: diagnosticSessionId,
    });

    logger.info('[diagnostic-auto-submit] completed', {
      userId,
      subjectId,
      answersSubmitted: answerEventData.length,
    });
  } catch (err) {
    logger.error('[diagnostic-auto-submit] error', {
      userId,
      subjectId,
      error: String(err),
    });
    throw err; // re-throw so BullMQ retries
  }
}
