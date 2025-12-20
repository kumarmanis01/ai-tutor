import { PrismaClient, Prisma } from '@prisma/client';
import evaluateAlerts from '../lib/alertEvaluator';
import { AlertRouter } from '../lib/alerts/router';
import { DryRunSink } from '../lib/alerts/sinks/dryRun';

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

  // Map evaluator results to AlertRouter payloads and route non-OKs.
  const severityMap = (d: string) => {
    if (d === 'CRITICAL') return 'critical';
    if (d === 'WARNING') return 'warning';
    if (d === 'ERROR') return 'error';
    return 'info';
  };

  for (const r of results) {
    try {
      if (r.decision && r.decision !== 'OK') {
        const alert = {
          title: `Alert: ${r.rule}`,
          message: `${r.rule} → ${r.decision}`,
          severity: severityMap(String(r.decision)),
          meta: { inputs: r.inputs },
          timestamp: t0.toISOString(),
        } as any;

        // Route via the router (dry-run sink will simply log)
        if ((global as any).alertRouter instanceof AlertRouter) {
          const res = await (global as any).alertRouter.route(alert);
          logDecision({ ...r, dryRun: DRY_RUN, routed: res });
        } else {
          // fallback: just log decision
          logDecision({ ...r, dryRun: DRY_RUN, routed: 'no-router' });
        }
      } else {
        logDecision({ ...r, dryRun: DRY_RUN });
      }
    } catch (e) {
      console.error('routing-error', String(e));
      logDecision({ ...r, dryRun: DRY_RUN, routingError: String(e) });
    }
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

  // Instantiate a local AlertRouter for dry-run testing. This uses the
  // DryRun sink which only logs alerts so no external notifications are sent.
  try {
    const router = new AlertRouter({ sinks: [new DryRunSink()] });
    (global as any).alertRouter = router;
  } catch (e) {
    console.error('alert-router-init-failed', String(e));
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
