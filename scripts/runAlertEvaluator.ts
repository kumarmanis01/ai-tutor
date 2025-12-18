import { PrismaClient, Prisma } from '@prisma/client';
import evaluateAlerts from '../lib/alertEvaluator';

const prisma = new PrismaClient();

const LOCK_KEY = Number(process.env.EVALUATOR_PG_LOCK_KEY || '987654321');
const INTERVAL_SEC = Number(process.env.EVALUATOR_INTERVAL_SEC || '60');
const MAX_MS = Number(process.env.EVALUATOR_MAX_MS || '10000');

const DRY_RUN = process.env.EVALUATOR_DRY_RUN === '1' || process.env.EVALUATOR_DRY_RUN === 'true';
const RUN_ONCE = process.env.RUN_ONCE === '1' || process.env.RUN_ONCE === 'true';

function now() {
  return new Date();
}

function logDecision(payload: any) {
  // Structured JSON log for easy ingestion
  console.log(JSON.stringify(payload));
}

async function runOnce() {
  const t0 = now();

  // RULE 1: QUEUE_BACKLOG
  const qThreshold = Number(process.env.QUEUE_BACKLOG_THRESHOLD || '50');
  const window5From = new Date(t0.getTime() - 5 * 60 * 1000);
  const window30From = new Date(t0.getTime() - 30 * 60 * 1000);

  const count5 = await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int as cnt FROM "TelemetrySample"
    WHERE "key" = 'queue.depth.value' AND "timestamp" >= ${window5From} AND "value" > ${qThreshold}
  `) as Array<{ cnt: number }>;
  const cnt5 = (count5 && count5[0]) ? Number(count5[0].cnt) : 0;

  const max30Res = await prisma.$queryRaw(Prisma.sql`
    SELECT MAX("value") as maxv FROM "TelemetrySample"
    WHERE "key" = 'queue.depth.value' AND "timestamp" >= ${window30From}
  `) as Array<{ maxv: number | null }>;
  const max30 = (max30Res && max30Res[0]) ? Number(max30Res[0].maxv ?? 0) : 0;

  const decision1 = (cnt5 >= 3) ? (max30 > Math.max(qThreshold, 200) ? 'CRITICAL' : 'WARNING') : 'OK';
  logDecision({ rule: 'QUEUE_BACKLOG', decision: decision1, inputs: { cnt5, max30 }, dryRun: DRY_RUN });

  if (!DRY_RUN && decision1 !== 'OK') {
    const severity = decision1 === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
    const message = `Queue backlog: ${cnt5} samples > ${qThreshold} in last 5m; max30=${max30}`;
    const payload = { cnt5, max30, threshold: qThreshold };
    const existing = await prisma.systemAlert.findFirst({ where: { type: 'QUEUE_BACKLOG', active: true } });
    if (existing) {
      await prisma.systemAlert.update({ where: { id: existing.id }, data: { lastSeen: new Date(), message, payload } });
    } else {
      await prisma.systemAlert.create({ data: { type: 'QUEUE_BACKLOG', severity: severity as any, message, payload } });
    }
  }

  // RULE 2: QUEUE_OLD_JOB_AGE
  const ageThreshold = Number(process.env.QUEUE_AGE_THRESHOLD || '300');
  const ageWindowFrom = new Date(t0.getTime() - 10 * 60 * 1000);
  const ageRow = await prisma.telemetrySample.findFirst({ where: { key: 'queue.oldest_age_sec.value', timestamp: { gte: ageWindowFrom } }, orderBy: { timestamp: 'desc' } });
  const oldestAge = ageRow ? Number(ageRow.value) : null;
  const decision2 = (oldestAge !== null && oldestAge > ageThreshold) ? 'CRITICAL' : 'OK';
  logDecision({ rule: 'QUEUE_OLD_JOB_AGE', decision: decision2, inputs: { oldestAge, ageThreshold }, dryRun: DRY_RUN });

  if (!DRY_RUN && decision2 === 'CRITICAL') {
    const message = `Oldest job age high: ${oldestAge}s (threshold ${ageThreshold}s)`;
    const payload = { oldestAge, threshold: ageThreshold };
    const existing = await prisma.systemAlert.findFirst({ where: { type: 'QUEUE_BACKLOG', active: true } });
    if (existing) {
      await prisma.systemAlert.update({ where: { id: existing.id }, data: { lastSeen: new Date(), message, payload } });
    } else {
      await prisma.systemAlert.create({ data: { type: 'QUEUE_BACKLOG', severity: 'CRITICAL' as any, message, payload } });
    }
  }

  // RULE 3: FAILED_JOBS_SPIKE
  const spikeMult = Number(process.env.FAILED_SPIKE_MULT || '5');
  const minAbs = Number(process.env.FAILED_SPIKE_MIN || '5');
  const recentFrom = new Date(t0.getTime() - 1 * 60 * 1000);
  const baselineFrom = new Date(t0.getTime() - 15 * 60 * 1000);

  const recentRes = await prisma.$queryRaw(Prisma.sql`
    SELECT COALESCE(SUM("value"),0)::int as s FROM "TelemetrySample"
    WHERE "key" = 'jobs.failed.count' AND "timestamp" >= ${recentFrom}
  `) as Array<{ s: number }>;
  const recentSum = recentRes && recentRes[0] ? Number(recentRes[0].s) : 0;

  const baseRes = await prisma.$queryRaw(Prisma.sql`
    SELECT COALESCE(AVG("value"),0)::double precision as avgv FROM "TelemetrySample"
    WHERE "key" = 'jobs.failed.count' AND "timestamp" >= ${baselineFrom} AND "timestamp" < ${recentFrom}
  `) as Array<{ avgv: number }>;
  const baselineAvg = baseRes && baseRes[0] ? Number(baseRes[0].avgv) : 0;

  const triggered = recentSum >= minAbs && (baselineAvg === 0 ? recentSum >= minAbs * spikeMult : recentSum > baselineAvg * spikeMult);
  const severity = triggered ? (recentSum > baselineAvg * spikeMult * 2 ? 'CRITICAL' : 'WARNING') : 'OK';
  logDecision({ rule: 'FAILED_JOBS_SPIKE', decision: severity, inputs: { recentSum, baselineAvg, spikeMult }, dryRun: DRY_RUN });

  if (!DRY_RUN && triggered) {
    const message = `Failed jobs spike: recent=${recentSum}, baselineAvg=${baselineAvg.toFixed(2)}`;
    const payload = { recentSum, baselineAvg };
    const existing = await prisma.systemAlert.findFirst({ where: { type: 'JOB_STUCK', active: true } });
    if (existing) {
      await prisma.systemAlert.update({ where: { id: existing.id }, data: { lastSeen: new Date(), message, payload } });
    } else {
      await prisma.systemAlert.create({ data: { type: 'JOB_STUCK', severity: (recentSum > baselineAvg * spikeMult * 2 ? 'CRITICAL' : 'WARNING') as any, message, payload } });
    }
  }

  return true;

}

async function tryAcquireLock() {
  try {
    const res = await prisma.$queryRaw(Prisma.sql`SELECT pg_try_advisory_lock(${LOCK_KEY}) as ok`);
    // @ts-ignore
    const ok = res && res[0] && (res[0].ok === true || res[0].ok === 1);
    return !!ok;
  } catch (e) {
    console.error('lock-acquire-error', String(e));
    return false;
  }
}

async function releaseLock() {
  try {
    await prisma.$executeRaw(Prisma.sql`SELECT pg_advisory_unlock(${LOCK_KEY})`);
  } catch (e) {
    console.error('lock-release-error', String(e));
  }
}

async function main() {
  try {
    await prisma.$connect();
  } catch (e) {
    console.error('Fatal: cannot connect to DB', String(e));
    process.exit(1);
  }

  async function singleRun() {
    const runId = (global as any).runId || (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now()));
    const started = Date.now();

    const locked = await tryAcquireLock();
    if (!locked) {
      console.log(JSON.stringify({ event: 'skipping_run', reason: 'lock held', runId, timestamp: new Date().toISOString() }));
      return;
    }

    try {
        const exec = Promise.resolve().then(() => runOnce());
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('evaluator-timeout')), MAX_MS));
      await Promise.race([exec, timeout]);
      const duration = Date.now() - started;
      console.log(JSON.stringify({ event: 'run_complete', runId, duration_ms: duration, dryRun: DRY_RUN, timestamp: new Date().toISOString() }));
    } catch (err) {
      console.error(JSON.stringify({ event: 'run_error', runId, error: String(err), dryRun: DRY_RUN, timestamp: new Date().toISOString() }));
      // If DB connectivity is lost, exit non-zero to let orchestrator restart and surface failure
      if (String(err).toLowerCase().includes('connect') || String(err).toLowerCase().includes('econnrefused')) {
        await releaseLock();
        process.exit(1);
      }
    } finally {
      try {
        await releaseLock();
      } catch (e) {
        console.error('releaseLock error', String(e));
      }
    }
  }

  if (RUN_ONCE) {
    await singleRun();
    process.exit(0);
  }

  console.log(JSON.stringify({ event: 'evaluator_starting', interval_sec: INTERVAL_SEC, max_ms: MAX_MS, dryRun: DRY_RUN }));
  // Run immediately then schedule
  await singleRun();
  setInterval(singleRun, INTERVAL_SEC * 1000);
}

main().catch((e) => { console.error(e); process.exit(1); });
