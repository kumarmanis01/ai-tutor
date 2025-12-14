import { Worker, Job } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { hydrateNotes } from "@/hydrators/hydrateNotes";
import { hydrateQuestions } from "@/hydrators/hydrateQuestions";
import { assembleTest } from "@/hydrators/assembleTest";
import { logger } from "@/lib/logger"; // Assumes you have a logger utility

/**
 * Single worker handling content hydration jobs.
 * Uses job.type routing for simplicity.
 */
export const contentWorker = new Worker(
  "content-hydration",
  async (job: Job) => {
    // 1️⃣ GLOBAL PAUSE CHECK (NON-NEGOTIABLE)
    const paused = await prisma.systemSetting.findUnique({
      where: { key: "AI_PAUSED" },
    });

    if (paused?.value === "true") {
      /**
       * Throwing causes BullMQ to retry later.
       * This is intentional.
       */
      throw new Error("AI_PAUSED");
    }

    const { type, payload } = job.data as {
      type: "NOTES" | "QUESTIONS" | "ASSEMBLE_TEST";
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
    connection: redis,

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
