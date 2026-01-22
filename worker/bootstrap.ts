/**
 * FILE OBJECTIVE:
 * - Start and manage a BullMQ worker lifecycle for content-hydration and related jobs.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/bootstrap.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-10T00:00:00Z | github-copilot | add Node types reference to fix "process" type error and update file header
 * - 2026-01-22T03:05:00Z | copilot | Phase 4: Switch to new worker service handlers (notesWorker, questionsWorker, assembleWorker)
 */

/* eslint-disable no-console */
/**
 * Worker bootstrap: starts a BullMQ worker with lifecycle management.
 *
 * Assumptions:
 * - Environment variables are already loaded (entry.ts handles dotenv)
 * - PM2 manages restarts
 */

import { Worker, Job } from "bullmq";
import minimist from "minimist";
import os from "os";

import { redisConnection } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js"

// Phase 4: Use new worker service handlers (not deprecated hydrators)
import { handleSyllabusJob } from "./index.js";
import { handleNotesJob } from "./services/notesWorker.js";
import { handleQuestionsJob } from "./services/questionsWorker.js";
import { handleAssembleJob } from "./services/assembleWorker.js";
import { startOutboxDispatcher, stopOutboxDispatcher } from "./outboxDispatcher.js";

const argv = minimist(process.argv.slice(2));

const workerType: string =
  argv.type || process.env.WORKER_TYPE || "content-hydration";

const lifecycleIdArg: string | undefined =
  argv.lifecycleId || argv.lifecycleid || argv.lid;

const concurrency = Number(
  argv.concurrency || process.env.WORKER_CONCURRENCY || 2
);

const heartbeatIntervalMs = Number(
  process.env.WORKER_HEARTBEAT_MS || 10_000
);

/* ------------------------------------------------------------------ */

async function ensureLifecycleRow(providedId?: string) {
  const host = os.hostname();
  const pid = process.pid;

  if (providedId) {
    await prisma.workerLifecycle.update({
      where: { id: providedId },
      data: {
        pid,
        host,
        status: "STARTING",
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    });
    return providedId;
  }

  const id = `wk-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  await prisma.workerLifecycle.create({
    data: {
      id,
      type: workerType,
      host,
      pid,
      status: "STARTING",
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
    },
  });

  return id;
}

/* ------------------------------------------------------------------ */

async function processor(job: Job) {
  const { type, payload } = job.data as any;

  // Phase 4: All job types now use worker service handlers that expect jobId
  // This ensures LLM calls only happen in worker context, not hydrators
  switch (type) {
    case "NOTES":
      if (!payload?.jobId) {
        throw new Error("NOTES job missing jobId");
      }
      return handleNotesJob(payload.jobId);

    case "QUESTIONS":
      if (!payload?.jobId) {
        throw new Error("QUESTIONS job missing jobId");
      }
      return handleQuestionsJob(payload.jobId);

    case "SYLLABUS":
      if (!payload?.jobId) {
        throw new Error("SYLLABUS job missing jobId");
      }
      return handleSyllabusJob(payload.jobId);

    case "ASSEMBLE_TEST":
      if (!payload?.jobId) {
        throw new Error("ASSEMBLE_TEST job missing jobId");
      }
      return handleAssembleJob(payload.jobId);

    default:
      throw new Error(`UNKNOWN_JOB_TYPE: ${type}`);
  }
}

/* ------------------------------------------------------------------ */

export async function bootstrapWorker() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required");
  }

  // Explicitly allow LLM calls in worker runtime only
  process.env.ALLOW_LLM_CALLS = "1";

  const lifecycleId = await ensureLifecycleRow(lifecycleIdArg);
  if (process.env.WORKER_DEBUG === '1') {
    try {
      const { getRedis } = await import('../lib/redis.js');
      const r = getRedis();
      const pong = await r.ping();
      logger.debug(`[worker][DEBUG] Redis ping: ${String(pong)}`);
    } catch (err) {
      logger.error('[worker][DEBUG] Redis ping failed', err);
    }
    logger.debug(`[worker][DEBUG] starting worker: type=${workerType} concurrency=${concurrency} lifecycleId=${lifecycleId}`);
  } else {
    logger.info(`[worker] starting worker: type=${workerType}`);
  }

  const worker = new Worker(
    workerType,
    async (job: Job) => processor(job),
    {
      connection: redisConnection,
      concurrency,
    }
  );

  // Debug events: active, stalled
    if (process.env.WORKER_DEBUG === '1') {
    worker.on('active', (job) => {
      try {
        logger.debug(`[worker][DEBUG] active job id=${job.id} name=${job.name} data=${JSON.stringify(job.data)}`);
      } catch (e) {
        logger.debug('[worker][DEBUG] active job (failed to stringify)', e);
      }
    });
    worker.on('stalled', (jobId) => {
      logger.warn(`[worker][DEBUG] stalled job id=${jobId}`);
    });
  }

  await prisma.workerLifecycle.update({
    where: { id: lifecycleId },
    data: {
      status: "RUNNING",
      lastHeartbeatAt: new Date(),
    },
  });

  // Start the outbox dispatcher to poll for unsent jobs and enqueue them
  // This runs alongside the BullMQ worker so jobs flow through the pipeline
  startOutboxDispatcher();

  const heartbeat = setInterval(async () => {
    try {
      await prisma.workerLifecycle.update({
        where: { id: lifecycleId },
        data: { lastHeartbeatAt: new Date() },
      });
    } catch (err) {
      logger.error("[worker] heartbeat failed", err);
    }
  }, heartbeatIntervalMs);

  async function shutdown(drain = true) {
    logger.info("[worker] shutdown requested; drain =", { drain })

    try {
      await prisma.workerLifecycle.update({
        where: { id: lifecycleId },
        data: { status: "DRAINING" },
      });

      if (drain) {
        await worker.pause();
        const timeout = Number(
          process.env.WORKER_DRAIN_TIMEOUT_MS || 30_000
        );
        await new Promise((r) =>
          setTimeout(r, Math.min(timeout, 5_000))
        );
      }

      clearInterval(heartbeat);
      await stopOutboxDispatcher();
      await worker.close();

      await prisma.workerLifecycle.update({
        where: { id: lifecycleId },
        data: { status: "STOPPED", stoppedAt: new Date() },
      });

      process.exit(0);
    } catch (err: any) {
      logger.error("[worker] shutdown error", err);

      await prisma.workerLifecycle.update({
        where: { id: lifecycleId },
        data: {
          status: "FAILED",
          stoppedAt: new Date(),
          meta: { error: String(err?.message || err) },
        },
      });

      process.exit(2);
    }
  }

  process.on("SIGINT", () => shutdown(true));
  process.on("SIGTERM", () => shutdown(true));

  worker.on("failed", (job, err) => {
    logger.error("[WORKER FAILED]", { jobId: job?.id, message: err?.message })
  });

  worker.on("completed", (job) => {
    logger.info("[WORKER COMPLETED]", { jobId: job.id })
  });
}

/* ------------------------------------------------------------------ */

// IMPORTANT: bootstrap.ts is NOT an entrypoint.
// entry.ts is responsible for calling this.
