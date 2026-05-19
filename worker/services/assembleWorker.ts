/**
 * FILE OBJECTIVE:
 * - Worker service handler for ASSEMBLE_TEST hydration jobs.
 * - Assembles and optionally auto-approves tests that meet criteria.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/assembleWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/AI_Execution_pipeline.md
 * - /docs/Hydration_Rules.md
 *
 * EDIT LOG:
 * - 2026-01-22T02:30:00Z | copilot | Phase 3: Created assemble worker handler
 * - 2026-01-23T08:00:00Z | copilot | Fixed: Use GeneratedQuestion relation instead of questionsJson field
 * - 2026-05-18T00:00:00Z | claude  | Invalidate questions:for-topic cache after test approval so newly assembled tests are visible without waiting for TTL
 * - 2026-05-19T00:00:00Z | claude  | fix: batch per-test update loop into updateMany; use returned count for accurate assembledCount
 * - 2026-05-19T00:00:00Z | copilot | fix: add explicit draft test result shape so approval filtering is type-safe
 * - 2026-05-19T00:00:00Z | copilot | fix: remove unused renderTemplate import revealed by strict type-check
 */

import { prisma } from '@/lib/prisma.js';
import { isSystemSettingEnabled } from '@/lib/systemSettings.js';
import { logger } from '@/lib/logger.js';
import { createStartedAIContentLog } from '@/lib/ai/aiContentLogHelper';
import { JobStatus } from '@/lib/ai-engine/types';
import { cacheDelPattern } from '@/lib/cache.js';

const MIN_QUESTIONS_FOR_APPROVAL = 5;

/**
 * Worker handler for ASSEMBLE_TEST hydration jobs.
 * Called by contentWorker when job.data.type === 'ASSEMBLE_TEST'.
 * 
 * Assembles tests by checking draft GeneratedTest records and optionally
 * auto-approving those that meet the minimum question threshold.
 * 
 * @param jobId - The HydrationJob ID to process
 */
export async function handleAssembleJob(jobId: string): Promise<void> {
  // Atomically claim the job
  const claim = await prisma.hydrationJob.updateMany({
    where: { id: jobId, status: JobStatus.Pending },
    data: { status: JobStatus.Running, attempts: { increment: 1 }, lockedAt: new Date() }
  });
  if (claim.count === 0) {
    logger.info('handleAssembleJob: job already claimed or not pending', { jobId });
    return;
  }

  const job = await prisma.hydrationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    logger.warn('handleAssembleJob: job not found', { jobId });
    return;
  }

  // Check global pause -- use Paused status so the resume route can find and re-enqueue this job
  const paused = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_PAUSED' } });
  if (isSystemSettingEnabled(paused?.value)) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Paused, lockedAt: null } });
    logger.info('handleAssembleJob: hydration paused, setting job to paused', { jobId });
    return;
  }

  const topicId = job.topicId;
  if (!topicId) {
    const { formatLastError, FailureCode } = await import('@/lib/failureCodes');
    const le = formatLastError(FailureCode.DEPENDENCY_MISSING, 'missing_topicId');
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } });
    throw new Error('missing_topicId');
  }

  // Verify topic exists
  const topic = await prisma.topicDef.findUnique({ where: { id: topicId } });
  if (!topic) {
    const { formatLastError, FailureCode } = await import('@/lib/failureCodes');
    const le = formatLastError(FailureCode.DEPENDENCY_MISSING, 'topic_not_found');
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } });
    throw new Error('topic_not_found');
  }

  const difficulty = job.difficulty || 'medium';
  const language = job.language || 'en';

  // Persist initial AIContentLog for observability (no LLM, but log job start)
  let aiLog: any = null;
  try {
    aiLog = await createStartedAIContentLog(prisma, {
      model: 'none',
      promptType: 'assemble',
      language,
      requestBody: { jobId: job.id },
      renderer: { schemaHash: null, version: null }
    });
    const runTxWithRetry = async (work: (tx: any) => Promise<any>, attempts = 3) => {
      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        try {
          return await prisma.$transaction(work);
        } catch (err: any) {
          lastErr = err;
          const msg = String(err?.message || '');
          if (/Transaction not found|Transaction API error/i.test(msg)) {
            const backoff = (i + 1) * 500;
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    };

    await runTxWithRetry(async (tx) => {
      // Find draft tests for this topic that match criteria, include question count
      const draftTests: Array<{ id: string; _count: { questions: number } }> = await tx.generatedTest.findMany({
        where: {
          topicId,
          language,
          difficulty,
          status: 'draft'
        },
        include: {
          _count: {
            select: { questions: true }
          }
        }
      });

      const qualifyingIds = draftTests
        .filter((t) => t._count.questions >= MIN_QUESTIONS_FOR_APPROVAL)
        .map((t) => t.id);

      let assembledCount = 0;

      if (qualifyingIds.length > 0) {
        // Use the authoritative DB count in case concurrent jobs changed status between our read and write
        const result = await tx.generatedTest.updateMany({
          where: { id: { in: qualifyingIds } },
          data: { status: 'approved' },
        });
        assembledCount = result.count;
        logger.info('handleAssembleJob: approved tests', { count: assembledCount, testIds: qualifyingIds });
      }

      // Mark hydration job completed (workers only update their own HydrationJob)
      await tx.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Completed, completedAt: new Date(), contentReady: assembledCount > 0 } });

      // Emit JobExecutionLog for observability but DO NOT mutate ExecutionJob
      const linked = await tx.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: job.id } } });
      if (linked) {
        const prevStatus = linked.status ?? null;
        await tx.jobExecutionLog.create({ data: { jobId: linked.id, event: 'COMPLETED', prevStatus, newStatus: prevStatus, meta: { hydrationJobId: job.id, assembledCount } } });
      }

      // Update AIContentLog as success
      if (aiLog?.id) {
        await tx.aIContentLog.update({ where: { id: aiLog.id }, data: {
          success: true,
          status: 'success',
          responseBody: { assembledCount }
        } });
      }

      logger.info('handleAssembleJob: completed', { jobId, topicId, assembledCount });
    });

    // Invalidate questions cache so the newly approved tests are immediately visible
    // without waiting for the 5-minute TTL to expire.
    if (topicId) {
      await cacheDelPattern(`questions:for-topic:v1:${topicId}:*`).catch(() => {});
    }
  } catch (err: any) {
    const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
    const code = inferFailureCodeFromMessage(err?.message || '');
    const le = formatLastError(code, String(err?.message || 'assemble_failed'));
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: le } });
    try { await prisma.aIContentLog.create({ data: { model: 'none', promptType: 'assemble', language: job.language || 'en', success: false, status: 'failed', error: le, requestBody: { jobId: job.id }, responseBody: null } }) } catch {}
    throw err;
  }
}

export default handleAssembleJob;
