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
 */

import { prisma } from '@/lib/prisma.js';
import { isSystemSettingEnabled } from '@/lib/systemSettings.js';
import { logger } from '@/lib/logger.js';
import { JobStatus } from '@/lib/ai-engine/types';

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
    data: { status: JobStatus.Running, attempts: { increment: 1 } }
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

  // Check global pause
  const paused = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_PAUSED' } });
  if (isSystemSettingEnabled(paused?.value)) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Pending } });
    logger.info('handleAssembleJob: paused, returning to pending', { jobId });
    return;
  }

  const topicId = job.topicId;
  if (!topicId) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: 'missing_topicId' } });
    throw new Error('missing_topicId');
  }

  // Verify topic exists
  const topic = await prisma.topicDef.findUnique({ where: { id: topicId } });
  if (!topic) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: 'topic_not_found' } });
    throw new Error('topic_not_found');
  }

  const difficulty = job.difficulty || 'medium';
  const language = job.language || 'en';

  try {
    await prisma.$transaction(async (tx) => {
      // Find draft tests for this topic that match criteria
      const draftTests = await tx.generatedTest.findMany({
        where: {
          topicId,
          language,
          difficulty,
          status: 'draft'
        }
      });

      let assembledCount = 0;

      for (const test of draftTests) {
        // Check if test has enough questions
        // questionsJson is an array of question objects
        const questions = test.questionsJson as any[];
        if (!questions || !Array.isArray(questions)) continue;

        if (questions.length >= MIN_QUESTIONS_FOR_APPROVAL) {
          // Auto-approve tests that meet threshold
          await tx.generatedTest.update({
            where: { id: test.id },
            data: { status: 'approved' }
          });
          assembledCount++;
          logger.info('handleAssembleJob: approved test', { testId: test.id, questionCount: questions.length });
        }
      }

      // Mark hydration job completed
      await tx.hydrationJob.update({
        where: { id: job.id },
        data: { status: JobStatus.Completed, completedAt: new Date(), contentReady: assembledCount > 0 }
      });

      // Mark linked ExecutionJob completed
      const linked = await tx.executionJob.findFirst({
        where: { payload: { path: ['hydrationJobId'], equals: job.id } }
      });
      if (linked) {
        const prevStatus = linked.status;
        await tx.executionJob.update({ where: { id: linked.id }, data: { status: 'completed', updatedAt: new Date() } });
        await tx.jobExecutionLog.create({
          data: { jobId: linked.id, event: 'COMPLETED', prevStatus, newStatus: 'completed', meta: { hydrationJobId: job.id, assembledCount } }
        });
      }

      logger.info('handleAssembleJob: completed', { jobId, topicId, assembledCount });
    });
  } catch (err: any) {
    await prisma.hydrationJob.update({ where: { id: job.id }, data: { status: JobStatus.Failed, lastError: err.message } });
    throw err;
  }
}

export default handleAssembleJob;
