import { PrismaClient, Prisma } from '@prisma/client';
let evaluateAlerts: any;
let AlertRouter: any;
let DryRunSink: any;
let SlackSink: any;
let WebhookSink: any;
let EmailSink: any;
let InMemoryRateLimiter: any;
let InMemoryDeduper: any;
let RedisRateLimiter: any;
let RedisDeduper: any;
let SinkWrapper: any;
let sendEmail: any;

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

  // Dynamically import evaluator to avoid ESM resolution issues when running
  // under different Node/ts-node invocation modes (register vs ESM loader).
  try {
    const mod = await import('../lib/alertEvaluator.js');
    evaluateAlerts = mod && (mod.default || mod.evaluateAlerts) ? (mod.default || mod.evaluateAlerts) : mod;
  } catch (e) {
    console.error('Failed to import alertEvaluator dynamically', String(e));
    process.exit(1);
  }

  // Dynamically load alerting infra modules so this script can run under
  // different node/ts-node loader modes without ESM resolution failures.
  try {
    const [mRouter, mDry, mSlack, mWebhook, mEmail, mInMemRL, mInMemDed, mRedisRL, mRedisDed, mSinkWrap, mMailer] = await Promise.all([
      import('../lib/alerts/router.js'),
      import('../lib/alerts/sinks/dryRun.js'),
      import('../lib/alerts/sinks/slack.js'),
      import('../lib/alerts/sinks/webhook.js'),
      import('../lib/alerts/sinks/email.js'),
      import('../lib/alerts/rateLimiter.js'),
      import('../lib/alerts/dedupe.js'),
      import('../lib/alerts/redisRateLimiter.js'),
      import('../lib/alerts/redisDeduper.js'),
      import('../lib/alerts/sinkWrapper.js'),
      import('../lib/mailer.js'),
    ]);

    AlertRouter = (mRouter as any).AlertRouter ?? (mRouter as any).default ?? (mRouter as any);
    DryRunSink = (mDry as any).DryRunSink ?? (mDry as any).default ?? (mDry as any);
    SlackSink = (mSlack as any).SlackSink ?? (mSlack as any).default ?? (mSlack as any);
    WebhookSink = (mWebhook as any).WebhookSink ?? (mWebhook as any).default ?? (mWebhook as any);
    EmailSink = (mEmail as any).EmailSink ?? (mEmail as any).default ?? (mEmail as any);
    InMemoryRateLimiter = (mInMemRL as any).InMemoryRateLimiter ?? (mInMemRL as any).default ?? (mInMemRL as any);
    InMemoryDeduper = (mInMemDed as any).InMemoryDeduper ?? (mInMemDed as any).default ?? (mInMemDed as any);
    RedisRateLimiter = (mRedisRL as any).RedisRateLimiter ?? (mRedisRL as any).default ?? (mRedisRL as any);
    RedisDeduper = (mRedisDed as any).RedisDeduper ?? (mRedisDed as any).default ?? (mRedisDed as any);
    SinkWrapper = (mSinkWrap as any).SinkWrapper ?? (mSinkWrap as any).default ?? (mSinkWrap as any);
    sendEmail = (mMailer as any).sendEmail ?? (mMailer as any).default ?? (mMailer as any);
  } catch (e) {
    console.error('Failed to dynamically import alerting modules', String(e));
    process.exit(1);
  }

  // Build sinks and supporting components based on environment.
  try {
    const sinks: any[] = [];

    const enableRealSinks = !DRY_RUN && (process.env.SLACK_WEBHOOK || process.env.PAGER_WEBHOOK || process.env.OPS_EMAIL);

    if (enableRealSinks) {
      if (process.env.SLACK_WEBHOOK) {
        sinks.push(new SinkWrapper(new SlackSink({ webhookUrl: process.env.SLACK_WEBHOOK!, channel: process.env.SLACK_CHANNEL, username: process.env.SLACK_USERNAME }), { retries: 3, backoffMs: 200 }));
      }
      if (process.env.PAGER_WEBHOOK) {
        sinks.push(new SinkWrapper(new WebhookSink({ url: process.env.PAGER_WEBHOOK! }), { retries: 2, backoffMs: 200 }));
      }
      if (process.env.OPS_EMAIL) {
        sinks.push(new SinkWrapper(new EmailSink({ to: process.env.OPS_EMAIL!, sendMail: sendEmail }), { retries: 1, backoffMs: 300 }));
      }
    }

    // Fallback to dry-run sink when no real sinks are configured.
    if (sinks.length === 0) sinks.push(new DryRunSink());

    // Rate limiter / deduper selection (prefer Redis when available)
    let rateLimiter: any;
    let deduper: any;
    if (process.env.REDIS_URL) {
      rateLimiter = new RedisRateLimiter({ capacity: Number(process.env.ALERT_RL_CAPACITY) || 10, windowSeconds: Number(process.env.ALERT_RL_WINDOW) || 60 });
      deduper = new RedisDeduper({ ttlSeconds: Number(process.env.ALERT_DEDUPE_TTL) || 60 * 10 });
    } else {
      rateLimiter = new InMemoryRateLimiter(Number(process.env.ALERT_RL_CAPACITY) || 5, Number(process.env.ALERT_RL_REFILL) || 0.2);
      deduper = new InMemoryDeduper(Number(process.env.ALERT_DEDUPE_TTL) || 60 * 10);
    }

    const router = new AlertRouter({ sinks, rateLimiter, deduper });
    (global as any).alertRouter = router;
    console.log(JSON.stringify({ event: 'alert_router_initialized', sinks: sinks.map((s: any) => s.name), dryRun: DRY_RUN }));
  } catch {
    console.error('alert-router-init-failed');
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

  // Graceful shutdown handling
  let shuttingDown = false;
  let currentRun: Promise<void> | null = null;

  async function shutdown(reason = 'signal') {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ event: 'shutdown_start', reason }));

    // wait for current run to finish with timeout
    const waitMs = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000);
    if (currentRun) {
      try {
        await Promise.race([currentRun, new Promise((_, rej) => setTimeout(() => rej(new Error('shutdown-timeout')), waitMs))]);
      } catch (e) {
        console.error('shutdown: wait current run error', String(e));
      }
    }

    // flush metrics if available and attempt to push to Pushgateway
    try {
      const { metricsOutput } = await import('../lib/alerts/metrics');
      const m = await metricsOutput();
      console.log(JSON.stringify({ event: 'metrics_snapshot', metrics: m }));
      const { pushMetricsOnce } = await import('../lib/alerts/pushgateway');
      if (typeof pushMetricsOnce === 'function') await pushMetricsOnce();
    } catch {
      // ignore
    }

    // attempt to disconnect redis-backed components if present on global router
    try {
      const router = (global as any).alertRouter;
      if (router) {
        const rl = (router as any).opts?.rateLimiter ?? (router as any).rateLimiter ?? (router as any).opts?.rateLimiter;
        const dd = (router as any).opts?.deduper ?? (router as any).deduper ?? (router as any).opts?.deduper;
        if (rl && typeof rl.disconnect === 'function') {
          await rl.disconnect().catch(() => {});
        }
        if (dd && typeof dd.disconnect === 'function') {
          await dd.disconnect().catch(() => {});
        }
      }
    } catch {
      // ignore
    }

    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }

    console.log(JSON.stringify({ event: 'shutdown_complete' }));
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => { console.error('uncaughtException', String(err)); shutdown('uncaughtException'); });

  // Run immediately then schedule
  currentRun = (async () => { await singleRun(); currentRun = null; })();
  setInterval(() => { currentRun = (async () => { await singleRun(); currentRun = null; })(); }, INTERVAL_SEC * 1000);
}

main().catch((e) => { console.error(e); process.exit(1); });
