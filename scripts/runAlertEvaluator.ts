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

  // Delegate core logic to the reusable evaluator and log decisions consistently.
  const results = await evaluateAlerts(prisma, { dryRun: DRY_RUN, now: t0 });
  for (const r of results) {
    logDecision({ ...r, dryRun: DRY_RUN });
  }
  return true;

}

async function tryAcquireLock() {
  try {
    const res = await prisma.$queryRaw(Prisma.sql`SELECT pg_try_advisory_lock(${LOCK_KEY}) as ok`) as unknown as Array<{ ok: boolean | number }>;
    const ok = !!(res && res[0] && (res[0].ok === true || res[0].ok === 1));
    return ok;
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
