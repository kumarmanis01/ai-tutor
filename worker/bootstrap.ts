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

import { redisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

import { hydrateNotes } from "@/hydrators/hydrateNotes";
import { hydrateQuestions } from "@/hydrators/hydrateQuestions";
import { assembleTest } from "@/hydrators/assembleTest";
import { handleSyllabusJob } from "./index";

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

  switch (type) {
    case "NOTES":
      return hydrateNotes(payload.topicId, payload.language);

    case "QUESTIONS":
      return hydrateQuestions(
        payload.topicId,
        payload.difficulty,
        payload.language
      );

    case "SYLLABUS":
      if (!payload?.jobId) {
        throw new Error("SYLLABUS job missing jobId");
      }
      return handleSyllabusJob(payload.jobId);

    case "ASSEMBLE_TEST":
      return assembleTest(payload.topicId);

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

  const worker = new Worker(
    workerType,
    async (job: Job) => processor(job),
    {
      connection: redisConnection,
      concurrency,
    }
  );

  await prisma.workerLifecycle.update({
    where: { id: lifecycleId },
    data: {
      status: "RUNNING",
      lastHeartbeatAt: new Date(),
    },
  });

  const heartbeat = setInterval(async () => {
    try {
      await prisma.workerLifecycle.update({
        where: { id: lifecycleId },
        data: { lastHeartbeatAt: new Date() },
      });
    } catch (err) {
      console.error("[worker] heartbeat failed", err);
    }
  }, heartbeatIntervalMs);

  async function shutdown(drain = true) {
    console.log("[worker] shutdown requested; drain =", drain);

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
      await worker.close();

      await prisma.workerLifecycle.update({
        where: { id: lifecycleId },
        data: { status: "STOPPED", stoppedAt: new Date() },
      });

      process.exit(0);
    } catch (err: any) {
      console.error("[worker] shutdown error", err);

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
    console.error("[WORKER FAILED]", job?.id, err?.message);
  });

  worker.on("completed", (job) => {
    console.log("[WORKER COMPLETED]", job.id);
  });
}

/* ------------------------------------------------------------------ */

// IMPORTANT: bootstrap.ts is NOT an entrypoint.
// entry.ts is responsible for calling this.
