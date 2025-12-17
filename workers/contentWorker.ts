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
 * Single worker handling content hydration jobs.
 * Uses job.type routing for simplicity.
 */
export const contentWorker = new Worker(
  "content-hydration",
  async (job: Job) => {
    // 1️⃣ GLOBAL PAUSE CHECK (NON-NEGOTIABLE)
    const paused = await prisma.systemSetting.findUnique({ where: { key: "AI_PAUSED" } });
    if (isSystemSettingEnabled(paused?.value)) {
      throw new Error("AI_PAUSED");
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

    /**
     * Keep concurrency low for AI + DB safety.
     * You can raise later after cost monitoring.
     */
    concurrency: 3,

    /**
     * Retry policy (important)
     */
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        return Math.min(60_000, 2 ** attemptsMade * 1000);
      },
    },
  }
);

/**
 * Optional: basic lifecycle logging
 */
contentWorker.on("failed", (job, err) => {
  logger.error(
    `[WORKER FAILED] jobId=${job?.id} type=${job?.data?.type}`,
    { error: err.message }
  );
});

contentWorker.on("completed", job => {
  logger.info(
    `[WORKER COMPLETED] jobId=${job.id} type=${job.data?.type}`
  );
});
