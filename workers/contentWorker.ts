/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 *
 * ⚠️ DO NOT:
 * - Call LLMs directly
 * - Mutate jobs after creation
 * - Add progress tracking
 * - Use router.refresh() with SWR
 */

import { Worker, Job } from "bullmq";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { isSystemSettingEnabled } from "@/lib/systemSettings";
import { hydrateNotes } from "@/hydrators/hydrateNotes";
import { hydrateQuestions } from "@/hydrators/hydrateQuestions";
import { assembleTest } from "@/hydrators/assembleTest";
import { handleSyllabusJob } from "@/workers/syllabusWorker";
import { logger } from "@/lib/logger"; // Assumes you have a logger utility

/**
 * Factory to start the content hydration worker.
 * This avoids creating Redis/Worker instances at module-import time.
 */
export function startContentWorker(opts?: { concurrency?: number }) {
  const concurrency = opts?.concurrency ?? 3;

  const worker = new Worker(
    "content-hydration",
    async (job: Job) => {
      // 1️⃣ GLOBAL PAUSE CHECK (NON-NEGOTIABLE)
      const paused = await prisma.systemSetting.findUnique({ where: { key: "AI_PAUSED" } });
      if (isSystemSettingEnabled(paused?.value)) {
        throw new Error("AI_PAUSED");
      }

      // Mark ExecutionJob as RUNNING and emit JobExecutionLog if jobId present
      try {
        const jobId = job.data?.payload?.jobId ?? job.data?.payload?.job_id ?? null;
        if (jobId) {
          await prisma.executionJob.update({ where: { id: String(jobId) }, data: { status: 'running', lockedAt: new Date(), lockedBy: `worker:${process.pid}` } });
          await prisma.jobExecutionLog.create({ data: { jobId: String(jobId), event: 'RUNNING', prevStatus: 'pending', newStatus: 'running', meta: { workerPid: process.pid } } });
        }
      } catch (e) {
        logger?.warn?.('worker: failed to mark ExecutionJob RUNNING or create JobExecutionLog', { err: e });
      }

      const { type, payload } = job.data as {
        type: "NOTES" | "QUESTIONS" | "ASSEMBLE_TEST" | "SYLLABUS";
        payload: any;
      };

      // 2️⃣ ROUTE JOBS BY TYPE
      switch (type) {
        case "NOTES": {
          const { topicId, language } = payload;
          return hydrateNotes(topicId, language);
        }

        case "QUESTIONS": {
          const { topicId, difficulty, language } = payload;
          return hydrateQuestions(topicId, difficulty, language);
        }

        case "SYLLABUS": {
          // payload should contain { jobId }
          const { jobId } = payload || {}
          if (!jobId) throw new Error("SYLLABUS job missing jobId")
          return handleSyllabusJob(jobId)
        }

        case "ASSEMBLE_TEST": {
          const { topicId } = payload;
          return assembleTest(topicId);
        }

        default:
          /**
           * Unknown jobs should NOT retry.
           */
          throw new Error(`UNKNOWN_JOB_TYPE: ${type}`);
      }
    },
    {
      connection: getRedis(),
      concurrency,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          return Math.min(60_000, 2 ** attemptsMade * 1000);
        },
      },
    }
  );

  worker.on("failed", (job, err) => {
    logger.error(
      `[WORKER FAILED] jobId=${job?.id} type=${job?.data?.type}`,
      { error: err?.message }
    );
    // If this job carried a ExecutionJob id, mark it failed and write a JobExecutionLog
    (async () => {
      try {
        const jobId = job?.data?.payload?.jobId ?? null;
        if (jobId) {
          await prisma.executionJob.update({ where: { id: String(jobId) }, data: { status: 'failed', lastError: String(err?.message ?? err) } });
          await prisma.jobExecutionLog.create({ data: { jobId: String(jobId), event: 'FAILED', prevStatus: 'running', newStatus: 'failed', message: String(err?.message ?? err) } });
        }
      } catch (e) {
        logger?.warn?.('worker.failed: failed to mark executionJob failed or write JobExecutionLog', { err: e });
      }
    })();
  });

  worker.on("completed", job => {
    logger.info(
      `[WORKER COMPLETED] jobId=${job.id} type=${job.data?.type}`
    );
    // mark ExecutionJob completed and write JobExecutionLog if jobId present
    (async () => {
      try {
        const jobId = job?.data?.payload?.jobId ?? null;
        if (jobId) {
          await prisma.executionJob.update({ where: { id: String(jobId) }, data: { status: 'completed' } });
          await prisma.jobExecutionLog.create({ data: { jobId: String(jobId), event: 'COMPLETED', prevStatus: 'running', newStatus: 'completed' } });
        }
      } catch (e) {
        logger?.warn?.('worker.completed: failed to mark executionJob completed or write JobExecutionLog', { err: e });
      }
    })();
  });

  return worker;
}
