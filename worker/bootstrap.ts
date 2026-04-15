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
import { logger } from "../lib/logger.js";
import { CONTENT_HYDRATION_QUEUE } from "../lib/queues/constants.js";

// Phase 4: Use new worker service handlers (not deprecated hydrators)
import { handleSyllabusJob } from "./index.js";
import { handleNotesJob } from "./services/notesWorker.js";
import { handleQuestionsJob } from "./services/questionsWorker.js";
import { handleAssembleJob } from "./services/assembleWorker.js";
import { processIRTUpdate } from "./services/irtWorker.js";
import { processNightlySM18 } from "./services/sm18Worker.js";
import { startOutboxDispatcher, stopOutboxDispatcher } from "./outboxDispatcher.js";
import { IRT_UPDATE_QUEUE_NAME } from "../jobs/irtUpdate.js";
import { SM18_SCHEDULER_QUEUE_NAME, registerNightlySM18Job } from "../jobs/sm18.js";
import { DIAGNOSTIC_BOOTSTRAP_QUEUE_NAME } from "../jobs/diagnosticBootstrap.js";
import { processDiagnosticBootstrap } from "./services/diagnosticBootstrapWorker.js";
import { WEEKLY_DIGEST_QUEUE_NAME, registerWeeklyDigestJob } from "../jobs/weeklyDigest.js";
import { processWeeklyDigest, processParentDigest } from "./services/weeklyDigestWorker.js";
import { SUBSCRIPTION_RENEWAL_QUEUE_NAME, registerSubscriptionRenewalJob } from "../jobs/subscriptionRenewal.js";
import { processRenewals } from "./services/subscriptionRenewalWorker.js";
import { PAYMENT_DUNNING_QUEUE_NAME, registerDailyDunningJob } from "../jobs/paymentDunning.js";
import { INSTALLMENT_DUNNING_QUEUE_NAME, registerDailyInstallmentDunningJob } from "../jobs/installmentDunning.js";
import { processPaymentDunning } from "./services/paymentDunningWorker.js";
import { processInstallmentDunning } from "./services/installmentDunningWorker.js";
import { DISTRESS_NOTIFICATION_QUEUE_NAME } from "../jobs/distressNotification.js";
import { processDistressNotification } from "./services/distressNotificationWorker.js";
import { RETEACH_PLAN_QUEUE_NAME } from "../jobs/reteachPlan.js";
import { processReteachPlan } from "./services/reteachPlanWorker.js";
import { DIAGNOSTIC_AUTO_SUBMIT_QUEUE_NAME } from "../jobs/diagnosticAutoSubmit.js";
import { processDiagnosticAutoSubmit } from "./services/diagnosticAutoSubmitWorker.js";
import { processAIRequest } from './services/aiRequestWorker.js';
import { AI_REQUEST_QUEUE } from '../lib/queues/constants.js';

const argv = minimist(process.argv.slice(2));

const workerType: string =
  argv.type || process.env.WORKER_TYPE || CONTENT_HYDRATION_QUEUE;

const lifecycleIdArg: string | undefined =
  argv.lifecycleId || argv.lifecycleid || argv.lid;

const concurrency = Number(
  argv.concurrency || process.env.WORKER_CONCURRENCY || 2
);

// If running in LLM safe mode, force a single concurrency to avoid parallel LLM calls
const isSafeMode = String(process.env.LLM_SAFE_MODE || "").toLowerCase() === "true";
const effectiveConcurrency = isSafeMode ? 1 : concurrency;

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

    case "PARENT_DIGEST":
      if (!payload?.parentId) {
        throw new Error("PARENT_DIGEST job missing parentId");
      }
      return processParentDigest(payload.parentId, payload.weekStart);

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
    logger.debug(`[worker][DEBUG] starting worker: type=${workerType} concurrency=${effectiveConcurrency} lifecycleId=${lifecycleId} safeMode=${String(isSafeMode)}`);
  } else {
    logger.info(`[worker] starting worker: type=${workerType} concurrency=${effectiveConcurrency}${isSafeMode? ' (LLM_SAFE_MODE)' : ''}`);
  }

  const worker = new Worker(
    workerType,
    async (job: Job) => processor(job),
    {
      connection: redisConnection,
      concurrency: effectiveConcurrency,
    }
  );

  const irtWorker = new Worker(
    IRT_UPDATE_QUEUE_NAME,
    async (job: Job) => processIRTUpdate(job as Job<import("../jobs/irtUpdate.js").IRTUpdateJobData>),
    {
      connection: redisConnection,
      concurrency: 2,
    }
  );

  const sm18Worker = new Worker(
    SM18_SCHEDULER_QUEUE_NAME,
    async (job: Job) => processNightlySM18(job),
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );
  await registerNightlySM18Job();

  const weeklyDigestWorker = new Worker(
    WEEKLY_DIGEST_QUEUE_NAME,
    async (_job: Job) => processWeeklyDigest(),
    { connection: redisConnection, concurrency: 1 },
  );
  await registerWeeklyDigestJob();
  // Register daily payment dunning job
  try {
    await registerDailyDunningJob();
    // Register daily installment-level dunning job
    try {
      await registerDailyInstallmentDunningJob();
    } catch (err) {
      logger.error('registerDailyInstallmentDunningJob failed', { error: String(err) });
    }
  } catch (err) {
    logger.error('registerDailyDunningJob failed', { error: String(err) });
  }

  const paymentDunningWorker = new Worker(
    PAYMENT_DUNNING_QUEUE_NAME,
    async (_job: Job) => processPaymentDunning(),
    { connection: redisConnection, concurrency: 1 },
  );

  const installmentDunningWorker = new Worker(
    INSTALLMENT_DUNNING_QUEUE_NAME,
    async (job: Job) => processInstallmentDunning(job.data),
    { connection: redisConnection, concurrency: 1 },
  );


  const subscriptionRenewalWorker = new Worker(
    SUBSCRIPTION_RENEWAL_QUEUE_NAME,
    async (_job: Job) => processRenewals(),
    { connection: redisConnection, concurrency: 1 },
  );
  await registerSubscriptionRenewalJob();

  const diagnosticBootstrapWorker = new Worker(
    DIAGNOSTIC_BOOTSTRAP_QUEUE_NAME,
    async (job: Job) => processDiagnosticBootstrap(job as any),
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  const distressNotificationWorker = new Worker(
    DISTRESS_NOTIFICATION_QUEUE_NAME,
    async (job: Job) => processDistressNotification(job as Job<import("../jobs/distressNotification.js").DistressNotificationJobData>),
    { connection: redisConnection, concurrency: 2 },
  );

  const reteachPlanWorker = new Worker(
    RETEACH_PLAN_QUEUE_NAME,
    async (job: Job) => processReteachPlan(job as Job<import("../jobs/reteachPlan.js").ReteachPlanJobData>),
    { connection: redisConnection, concurrency: 2 },
  );

  const diagnosticAutoSubmitWorker = new Worker(
    DIAGNOSTIC_AUTO_SUBMIT_QUEUE_NAME,
    async (job: Job) => processDiagnosticAutoSubmit(job as Job<import("../jobs/diagnosticAutoSubmit.js").DiagnosticAutoSubmitJobData>),
    { connection: redisConnection, concurrency: 2 },
  );

  const aiWorker = new Worker(
    AI_REQUEST_QUEUE,
    async (job: Job) => processAIRequest(job),
    { connection: redisConnection, concurrency: Number(process.env.AI_WORKER_CONCURRENCY || 2) },
  );

  aiWorker.on('failed', (job, err) => {
    logger.error(`[AI WORKER FAILED] jobId=${job?.id}`, { error: err?.message });
  });

  aiWorker.on('completed', (job) => {
    logger.info(`[AI WORKER COMPLETED] jobId=${job.id}`);
  });

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
      await irtWorker.close();
      await sm18Worker.close();
      await weeklyDigestWorker.close();
      await distressNotificationWorker.close();
      await reteachPlanWorker.close();
      await diagnosticAutoSubmitWorker.close();

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
