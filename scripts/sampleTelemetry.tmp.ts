#!/usr/bin/env node
/**
 * Temporary runner for sampler that uses relative imports (no path aliases)
 * This file is for one-off execution only.
 */
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getContentQueue } from '@/queues/contentQueue';
import { logger } from '@/lib/logger';

function startOfMinute(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0);
}

function stableStringify(obj: any): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return JSON.stringify(obj.map(stableStringify));
  const keys = Object.keys(obj).sort();
  const out: any = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

function dimHash(dim: any) {
  try {
    const s = stableStringify(dim ?? {});
    return crypto.createHash('sha1').update(s).digest('hex');
  } catch {
    return crypto.createHash('sha1').update(String(dim ?? '')).digest('hex');
  }
}

async function checkDatabase() {
  try {
    // quick ping
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const r: any = await prisma.$queryRaw`SELECT 1`; // will throw if DB unavailable
    return true;
  } catch (err) {
    logger.error('DB availability check failed in sampler', { method: 'checkDatabase', err });
    return false;
  }
}

async function runOnce() {
  const now = new Date();
  const bucketTs = startOfMinute(now);
  const intervalStart = new Date(bucketTs.getTime() - 60 * 1000);
  const intervalEnd = bucketTs;

  // ensure DB is available before proceeding
  const dbOk = await checkDatabase();
  if (!dbOk) {
    logger.error('DB not available; sampler exiting', { method: 'runOnce' });
    process.exit(2);
  }

  const rowsToInsert: Array<{
    id: string;
    key: string;
    timestamp: Date;
    value: number;
    dimensions?: any;
    meta?: any;
    dimensionHash: string;
  }> = [];

  try {
    // Jobs: created per status in interval
    const jobsCreated = await prisma.$queryRaw`
      SELECT "status", COUNT(*)::int as cnt
      FROM "ExecutionJob"
      WHERE "createdAt" >= ${intervalStart} AND "createdAt" < ${intervalEnd}
      GROUP BY "status"
    ` as Array<{ status: string; cnt: number }>;

    for (const jc of jobsCreated) {
      const key = `jobs.created.count`;
      const dims = { status: jc.status };
      const dh = dimHash(dims);
      rowsToInsert.push({ id: crypto.randomUUID(), key, timestamp: bucketTs, value: jc.cnt, dimensions: dims, meta: null, dimensionHash: dh });
    }

    // Jobs failed in interval (explicit)
    const jobsFailed = await prisma.$queryRaw`
      SELECT COUNT(*)::int as cnt
      FROM "ExecutionJob"
      WHERE "createdAt" >= ${intervalStart} AND "createdAt" < ${intervalEnd} AND "status" = 'failed'
    ` as Array<{ cnt: number }>;
    if (jobsFailed && jobsFailed[0]) {
      const key = `jobs.failed.count`;
      const dh = dimHash({});
      rowsToInsert.push({ id: crypto.randomUUID(), key, timestamp: bucketTs, value: jobsFailed[0].cnt, dimensions: null, meta: null, dimensionHash: dh });
    }

    // Jobs running (point-in-time)
    const jobsRunningCount = await prisma.executionJob.count({ where: { status: 'running' } });
    rowsToInsert.push({ id: crypto.randomUUID(), key: `jobs.running.count`, timestamp: bucketTs, value: jobsRunningCount, dimensions: null, meta: null, dimensionHash: dimHash({}) });

    // Workers: running and stale
    const workersRunning = await prisma.workerLifecycle.count({ where: { status: 'RUNNING' } });
    // stale: lastHeartbeatAt older than 60s for workers that should be heartbeating (exclude STOPPED/FAILED)
    const staleThreshold = new Date(Date.now() - 60 * 1000);
    const workersStale = await prisma.workerLifecycle.count({ where: { status: { in: ['RUNNING', 'DRAINING'] }, lastHeartbeatAt: { lt: staleThreshold } } });
    rowsToInsert.push({ id: crypto.randomUUID(), key: `workers.running.count`, timestamp: bucketTs, value: workersRunning, dimensions: null, meta: null, dimensionHash: dimHash({}) });
    rowsToInsert.push({ id: crypto.randomUUID(), key: `workers.stale.count`, timestamp: bucketTs, value: workersStale, dimensions: null, meta: null, dimensionHash: dimHash({}) });

    // Queue (BullMQ)
    let queueDepth = 0;
    let oldestJobAgeSec: number | null = null;
    try {
      const queue = getContentQueue();
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
      queueDepth = (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);
      const jobs = await queue.getJobs(['waiting', 'active'], 0, 0, true);
      if (jobs && jobs.length > 0) {
        const job = jobs[0];
        const ts = (job.timestamp || job['timestamp'] || Date.now()) as number;
        oldestJobAgeSec = Math.floor((Date.now() - ts) / 1000);
      }
    } catch (e) {
      logger.warn('Queue metrics fetch failed; skipping queue metrics', { method: 'runOnce', err: e });
      queueDepth = 0;
      oldestJobAgeSec = null;
    }
    rowsToInsert.push({ id: crypto.randomUUID(), key: `queue.depth.value`, timestamp: bucketTs, value: queueDepth, dimensions: null, meta: null, dimensionHash: dimHash({}) });
    if (oldestJobAgeSec !== null) rowsToInsert.push({ id: crypto.randomUUID(), key: `queue.oldest_age_sec.value`, timestamp: bucketTs, value: oldestJobAgeSec, dimensions: null, meta: null, dimensionHash: dimHash({}) });

    // Alerts
    const alertsActive = await prisma.systemAlert.count({ where: { active: true } });
    rowsToInsert.push({ id: crypto.randomUUID(), key: `alerts.active.count`, timestamp: bucketTs, value: alertsActive, dimensions: null, meta: null, dimensionHash: dimHash({}) });

    // Insert rows idempotently
    for (const r of rowsToInsert) {
      try {
        await prisma.$executeRaw`
          INSERT INTO "TelemetrySample" ("id","key","timestamp","value","dimensions","dimensionHash","meta","createdAt")
          VALUES (${r.id}, ${r.key}, ${r.timestamp}, ${r.value}, ${r.dimensions ? JSON.stringify(r.dimensions) : null}, ${r.dimensionHash}, ${r.meta ? JSON.stringify(r.meta) : null}, now())
          ON CONFLICT ("key","timestamp","dimensionHash") DO NOTHING
        `;
      } catch (e) {
        logger.error('Failed writing TelemetrySample row', { method: 'runOnce', err: e, row: r });
        // per guardrail: exit non-zero so cron/supervisor observes failure
        process.exit(1);
      }
    }

    logger.info(`Telemetry sampler wrote ${rowsToInsert.length} rows`, { method: 'runOnce', bucket: bucketTs.toISOString() });
  } catch (err) {
    logger.error('Sampler run failed', { method: 'runOnce', err });
    process.exit(1);
  }
}

async function main() {
  const runOnceMode = process.env.RUN_ONCE === '1' || process.env.RUN_ONCE === 'true';
  if (runOnceMode) {
    await runOnce();
    process.exit(0);
  }

  const intervalSec = Number(process.env.SAMPLE_INTERVAL_SEC || '60');
  logger.info(`Starting telemetry sampler with interval ${intervalSec}s`);
  await runOnce();
  setInterval(() => {
    runOnce().catch((e) => {
      logger.error('Periodic sampler run error', { err: e });
    });
  }, intervalSec * 1000);
}

main().catch((e) => {
  logger.error('Sampler main failed', { err: e });
  process.exit(1);
});
