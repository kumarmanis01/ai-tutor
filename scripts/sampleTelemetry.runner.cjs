#!/usr/bin/env node
/*
  One-off telemetry sampler runner (CommonJS) that avoids TS path-aliases.
  - Uses @prisma/client directly
  - Connects to Redis via REDIS_URL and BullMQ
  - Writes idempotent rows to TelemetrySample
*/
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const IORedis = require('ioredis');
const { Queue } = require('bullmq');

const prisma = new PrismaClient();

function startOfMinute(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0);
}

function stableStringify(obj) {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return JSON.stringify(obj.map(stableStringify));
  const keys = Object.keys(obj).sort();
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

function dimHash(dim) {
  try {
    const s = stableStringify(dim ?? {});
    return crypto.createHash('sha1').update(s).digest('hex');
  } catch {
    return crypto.createHash('sha1').update(String(dim ?? '')).digest('hex');
  }
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.error('DB availability check failed in sampler', err);
    return false;
  }
}

async function runOnce() {
  const now = new Date();
  const bucketTs = startOfMinute(now);
  const intervalStart = new Date(bucketTs.getTime() - 60 * 1000);
  const intervalEnd = bucketTs;

  const dbOk = await checkDatabase();
  if (!dbOk) {
    console.error('DB not available; sampler exiting');
    process.exit(2);
  }

  const rowsToInsert = [];

  try {
    const jobsCreated = await prisma.$queryRaw`
      SELECT "status", COUNT(*)::int as cnt
      FROM "ExecutionJob"
      WHERE "createdAt" >= ${intervalStart} AND "createdAt" < ${intervalEnd}
      GROUP BY "status"
    `;

    for (const jc of jobsCreated) {
      const key = `jobs.created.count`;
      const dims = { status: jc.status };
      const dh = dimHash(dims);
      rowsToInsert.push({ id: crypto.randomUUID(), key, timestamp: bucketTs, value: jc.cnt, dimensions: dims, meta: null, dimensionHash: dh });
    }

    const jobsFailed = await prisma.$queryRaw`
      SELECT COUNT(*)::int as cnt
      FROM "ExecutionJob"
      WHERE "createdAt" >= ${intervalStart} AND "createdAt" < ${intervalEnd} AND "status" = 'failed'
    `;
    if (jobsFailed && jobsFailed[0]) {
      const key = `jobs.failed.count`;
      const dh = dimHash({});
      rowsToInsert.push({ id: crypto.randomUUID(), key, timestamp: bucketTs, value: jobsFailed[0].cnt, dimensions: null, meta: null, dimensionHash: dh });
    }

    const jobsRunningCount = await prisma.executionJob.count({ where: { status: 'running' } });
    rowsToInsert.push({ id: crypto.randomUUID(), key: `jobs.running.count`, timestamp: bucketTs, value: jobsRunningCount, dimensions: null, meta: null, dimensionHash: dimHash({}) });

    const workersRunning = await prisma.workerLifecycle.count({ where: { status: 'RUNNING' } });
    const staleThreshold = new Date(Date.now() - 60 * 1000);
    const workersStale = await prisma.workerLifecycle.count({ where: { status: { in: ['RUNNING', 'DRAINING'] }, lastHeartbeatAt: { lt: staleThreshold } } });
    rowsToInsert.push({ id: crypto.randomUUID(), key: `workers.running.count`, timestamp: bucketTs, value: workersRunning, dimensions: null, meta: null, dimensionHash: dimHash({}) });
    rowsToInsert.push({ id: crypto.randomUUID(), key: `workers.stale.count`, timestamp: bucketTs, value: workersStale, dimensions: null, meta: null, dimensionHash: dimHash({}) });

    // Queue
    let queueDepth = 0;
    let oldestJobAgeSec = null;
    try {
      if (!process.env.REDIS_URL) throw new Error('REDIS_URL not set');
      const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
      const queue = new Queue('content-hydration', { connection });
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
      queueDepth = (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);
      const jobs = await queue.getJobs(['waiting', 'active'], 0, 0, true);
      if (jobs && jobs.length > 0) {
        const job = jobs[0];
        const ts = (job.timestamp || job['timestamp'] || Date.now());
        oldestJobAgeSec = Math.floor((Date.now() - ts) / 1000);
      }
      await connection.quit();
    } catch (e) {
      console.warn('Queue metrics fetch failed; skipping queue metrics', e);
      queueDepth = 0;
      oldestJobAgeSec = null;
    }
    rowsToInsert.push({ id: crypto.randomUUID(), key: `queue.depth.value`, timestamp: bucketTs, value: queueDepth, dimensions: null, meta: null, dimensionHash: dimHash({}) });
    if (oldestJobAgeSec !== null) rowsToInsert.push({ id: crypto.randomUUID(), key: `queue.oldest_age_sec.value`, timestamp: bucketTs, value: oldestJobAgeSec, dimensions: null, meta: null, dimensionHash: dimHash({}) });

    const alertsActive = await prisma.systemAlert.count({ where: { active: true } }).catch(()=>0);
    rowsToInsert.push({ id: crypto.randomUUID(), key: `alerts.active.count`, timestamp: bucketTs, value: alertsActive, dimensions: null, meta: null, dimensionHash: dimHash({}) });

    for (const r of rowsToInsert) {
      try {
        await prisma.$executeRaw`
          INSERT INTO "TelemetrySample" ("id","key","timestamp","value","dimensions","dimensionHash","meta","createdAt")
          VALUES (${r.id}, ${r.key}, ${r.timestamp}, ${r.value}, ${r.dimensions ? JSON.stringify(r.dimensions) : null}, ${r.dimensionHash}, ${r.meta ? JSON.stringify(r.meta) : null}, now())
          ON CONFLICT ("key","timestamp","dimensionHash") DO NOTHING
        `;
      } catch (e) {
        console.error('Failed writing TelemetrySample row', e, r);
        process.exit(1);
      }
    }

    console.info(`Telemetry runner wrote ${rowsToInsert.length} rows`);
  } catch (err) {
    console.error('Sampler run failed', err);
    process.exit(1);
  }
}

runOnce().then(()=> process.exit(0)).catch(e=>{ console.error(e); process.exit(1); });
