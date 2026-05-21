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
 * - 2026-05-19T00:00:00Z | claude  | feat: add pdfIngestWorker for NCERT textbook PDF ingestion pipeline
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
import { AI_REQUEST_QUEUE, ANALYTICS_INGEST_QUEUE, PDF_INGEST_QUEUE } from '../lib/queues/constants.js';
import { processAnalyticsIngest } from './services/analyticsIngestWorker.js';
import type { AnalyticsIngestPayload } from './services/analyticsIngestWorker.js';
import { processPdfIngestJob } from './services/pdfIngestWorker.js';
import type { PdfIngestJobPayload } from './services/pdfIngestWorker.js';

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
      if (!r) {
        logger.warn('[worker][DEBUG] Redis client unavailable');
      } else {
        const pong = await r.ping();
        logger.debug(`[worker][DEBUG] Redis ping: ${String(pong)}`);
      }
    } catch (err) {
      logger.error('[worker][DEBUG] Redis ping failed', { error: String(err) });
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
      lockDuration: 10 * 60 * 1000, // 10 min -- covers worst-case 3-difficulty LLM batch
    }
  );

  const irtWorker = new Worker(
    IRT_UPDATE_QUEUE_NAME,
    async (job: Job) => processIRTUpdate(job as Job<import("../jobs/irtUpdate.js").IRTUpdateJobData>),
    {
      connection: redisConnection,
      concurrency: 2,
      lockDuration: 2 * 60 * 1000, // 2 min
    }
  );

  const sm18Worker = new Worker(
    SM18_SCHEDULER_QUEUE_NAME,
    async (job: Job) => processNightlySM18(job),
    {
      connection: redisConnection,
      concurrency: 1,
      lockDuration: 5 * 60 * 1000, // 5 min -- nightly batch
    }
  );
  await registerNightlySM18Job();

  const weeklyDigestWorker = new Worker(
    WEEKLY_DIGEST_QUEUE_NAME,
    async (_job: Job) => processWeeklyDigest(),
    { connection: redisConnection, concurrency: 1, lockDuration: 5 * 60 * 1000 },
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
    { connection: redisConnection, concurrency: 1, lockDuration: 2 * 60 * 1000 },
  );

  const installmentDunningWorker = new Worker(
    INSTALLMENT_DUNNING_QUEUE_NAME,
    async (job: Job) => processInstallmentDunning(job.data),
    { connection: redisConnection, concurrency: 1, lockDuration: 2 * 60 * 1000 },
  );

  const subscriptionRenewalWorker = new Worker(
    SUBSCRIPTION_RENEWAL_QUEUE_NAME,
    async (_job: Job) => processRenewals(),
    { connection: redisConnection, concurrency: 1, lockDuration: 2 * 60 * 1000 },
  );
  await registerSubscriptionRenewalJob();

  const diagnosticBootstrapWorker = new Worker(
    DIAGNOSTIC_BOOTSTRAP_QUEUE_NAME,
    async (job: Job) => processDiagnosticBootstrap(job as any),
    {
      connection: redisConnection,
      concurrency: 1,
      lockDuration: 3 * 60 * 1000, // 3 min
    }
  );

  // Skip creating a persistent Worker when distress detection is disabled.
  // Each BullMQ Worker holds 2 Redis connections permanently (blocking + ops).
  // With Redis Cloud free tier capped at 30 connections, every idle worker counts.
  const distressNotificationWorker = process.env.ENABLE_DISTRESS_DETECTION === 'true'
    ? new Worker(
        DISTRESS_NOTIFICATION_QUEUE_NAME,
        async (job: Job) => processDistressNotification(job as Job<import("../jobs/distressNotification.js").DistressNotificationJobData>),
        { connection: redisConnection, concurrency: 2, lockDuration: 60 * 1000 },
      )
    : null;

  const reteachPlanWorker = new Worker(
    RETEACH_PLAN_QUEUE_NAME,
    async (job: Job) => processReteachPlan(job as Job<import("../jobs/reteachPlan.js").ReteachPlanJobData>),
    { connection: redisConnection, concurrency: 2, lockDuration: 3 * 60 * 1000 },
  );

  const diagnosticAutoSubmitWorker = new Worker(
    DIAGNOSTIC_AUTO_SUBMIT_QUEUE_NAME,
    async (job: Job) => processDiagnosticAutoSubmit(job as Job<import("../jobs/diagnosticAutoSubmit.js").DiagnosticAutoSubmitJobData>),
    { connection: redisConnection, concurrency: 2, lockDuration: 60 * 1000 },
  );

  const aiWorker = new Worker(
    AI_REQUEST_QUEUE,
    async (job: Job) => processAIRequest(job),
    { connection: redisConnection, concurrency: Number(process.env.AI_WORKER_CONCURRENCY || 2), lockDuration: 5 * 60 * 1000 },
  );

  const analyticsIngestWorker = new Worker<AnalyticsIngestPayload>(
    ANALYTICS_INGEST_QUEUE,
    async (job: Job<AnalyticsIngestPayload>) => processAnalyticsIngest(job),
    {
      connection: redisConnection,
      // ANALYTICS_INGEST_BATCH_SIZE controls DB insert batch size in the worker handler,
      // not the number of concurrent BullMQ jobs. Use a separate env var for concurrency.
      concurrency: Number(process.env.ANALYTICS_INGEST_CONCURRENCY || 10),
      lockDuration: 60 * 1000, // 1 min -- ingest jobs are fast
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 50 },
    },
  );

  const pdfIngestWorker = new Worker<PdfIngestJobPayload>(
    PDF_INGEST_QUEUE,
    async (job: Job<PdfIngestJobPayload>) => processPdfIngestJob(job.data),
    {
      connection: redisConnection,
      concurrency: 2, // parse 2 PDFs at a time (CPU-bound but not LLM-bound)
      lockDuration: 10 * 60 * 1000, // 10 min -- large PDFs can take a while
    },
  );

  pdfIngestWorker.on('failed', (job, err) => {
    logger.error('[PDF_INGEST FAILED]', { jobId: job?.id, error: err?.message });
  });

  pdfIngestWorker.on('completed', (job) => {
    logger.info('[PDF_INGEST COMPLETED]', { jobId: job.id });
  });

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
        logger.debug('[worker][DEBUG] active job (failed to stringify)', { error: String(e) });
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
        logger.error("[worker] heartbeat failed", { error: String(err) });
      }
  }, heartbeatIntervalMs);

  async function shutdown(drain = true) {
    logger.info("[worker] shutdown requested; drain =", { drain })

    // Safety deadline: force-exit before PM2's kill_timeout (15 000 ms) fires.
    // Gives the graceful path 12 s to finish; after that we exit anyway.
    const safetyExit = setTimeout(() => {
      logger.error("[worker] shutdown deadline exceeded -- forcing exit");
      process.exit(1);
    }, 12_000);
    safetyExit.unref(); // don't keep the event loop alive on its own

    try {
      await prisma.workerLifecycle.update({
        where: { id: lifecycleId },
        data: { status: "DRAINING" },
      });

      if (drain) {
        await worker.pause();
        // Cap drain wait well below kill_timeout so we have time to close cleanly.
        const drainMs = Math.min(
          Number(process.env.WORKER_DRAIN_TIMEOUT_MS || 5_000),
          3_000,
        );
        await new Promise((r) => setTimeout(r, drainMs));
      }

      clearInterval(heartbeat);
      stopOutboxDispatcher();

      // Close all BullMQ workers in parallel to minimise total shutdown time.
      await Promise.all([
        worker.close(),
        irtWorker.close(),
        sm18Worker.close(),
        weeklyDigestWorker.close(),
        paymentDunningWorker.close(),
        installmentDunningWorker.close(),
        subscriptionRenewalWorker.close(),
        diagnosticBootstrapWorker.close(),
        distressNotificationWorker ? distressNotificationWorker.close() : Promise.resolve(),
        reteachPlanWorker.close(),
        diagnosticAutoSubmitWorker.close(),
        aiWorker.close(),
        analyticsIngestWorker.close(),
        pdfIngestWorker.close(),
      ]);

      await prisma.workerLifecycle.update({
        where: { id: lifecycleId },
        data: { status: "STOPPED", stoppedAt: new Date() },
      });
    } catch (err: any) {
      logger.error("[worker] shutdown error", { error: String(err) });
      try {
        await prisma.workerLifecycle.update({
          where: { id: lifecycleId },
          data: {
            status: "FAILED",
            stoppedAt: new Date(),
            meta: { error: String(err?.message || err) },
          },
        });
      } catch {
        // best-effort
      }
    } finally {
      clearTimeout(safetyExit);
      await prisma.$disconnect().catch(() => null);
      process.exit(0);
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
