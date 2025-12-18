import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { getContentQueue } from '@/queues/contentQueue';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface SystemHealth {
  overall: HealthStatus;
  timestamp: string;
  dependencies: {
    database: { status: HealthStatus; latencyMs?: number; error?: string };
    redis: { status: HealthStatus; latencyMs?: number; error?: string };
  };
  workers: { running: number; stale: number; failed: number; lastHeartbeatAgeSec?: number };
  jobs: { pending: number; running: number; failedLast5m: number; stuckRunning: number };
  queue: { depth: number; oldestJobAgeSec?: number };
  raw?: any;
}

const MAX_JOB_RUNTIME_MS = Number(process.env.MAX_JOB_RUNTIME_MS || 1000 * 60 * 10); // 10m default

function classifyLatency(ms?: number) {
  if (ms === undefined) return 'unhealthy' as HealthStatus;
  if (ms < 200) return 'healthy' as HealthStatus;
  if (ms < 1000) return 'degraded' as HealthStatus;
  return 'unhealthy' as HealthStatus;
}

export async function systemHealth(): Promise<SystemHealth> {
  const now = Date.now();

  // DB health
  let dbLatencyMs: number | undefined;
  let dbStatus: HealthStatus = 'unhealthy';
  try {
    const s = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - s;
    dbStatus = classifyLatency(dbLatencyMs);
  } catch {
    dbStatus = 'unhealthy';
  }

  // Redis health
  let redisLatencyMs: number | undefined;
  let redisStatus: HealthStatus = 'unhealthy';
  try {
    const redis = getRedis();
    const s = Date.now();
    await redis.ping();
    redisLatencyMs = Date.now() - s;
    redisStatus = classifyLatency(redisLatencyMs);
  } catch {
    redisStatus = 'unhealthy';
  }

  // Workers
  const workersRaw = await prisma.workerLifecycle.findMany();
  let running = 0,
    stale = 0,
    failed = 0;
  let lastHeartbeatAgeSec: number | undefined = undefined;
  for (const w of workersRaw) {
    const hb = w.lastHeartbeatAt ? Math.floor((now - new Date(w.lastHeartbeatAt).getTime()) / 1000) : Infinity;
    if (hb !== Infinity) lastHeartbeatAgeSec = Math.max(lastHeartbeatAgeSec ?? 0, hb);
    if (String(w.status).toLowerCase() === 'failed') failed++;
    else if (hb <= 30) running++;
    else if (hb > 60) stale++;
    else running++;
  }

  // Jobs
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const [pending, runningJobs, failedLast5m, stuckRunning] = await Promise.all([
    prisma.executionJob.count({ where: { status: 'pending' } }),
    prisma.executionJob.count({ where: { status: 'running' } }),
    prisma.executionJob.count({ where: { status: 'failed', updatedAt: { gte: fiveMinAgo } } }),
    prisma.executionJob.count({ where: { status: 'running', lockedAt: { lt: new Date(Date.now() - MAX_JOB_RUNTIME_MS) } } }),
  ]);

  // Queue (BullMQ)
  let depth = 0;
  let oldestJobAgeSec: number | undefined = undefined;
  try {
    const queue = getContentQueue();
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
    depth = (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);
    const jobs = await queue.getJobs(['waiting', 'active'], 0, 0, true);
    if (jobs && jobs.length > 0) {
      const job = jobs[0];
      const ts = (job.timestamp || job['timestamp'] || Date.now()) as number;
      oldestJobAgeSec = Math.floor((Date.now() - ts) / 1000);
    }
  } catch {
    // keep defaults; Redis health above will reflect connectivity
  }

  const overall =
    dbStatus === 'unhealthy' || redisStatus === 'unhealthy'
      ? 'unhealthy'
      : stale > 0 || stuckRunning > 0 || (oldestJobAgeSec ?? 0) > 300
      ? 'degraded'
      : 'healthy';

  const health: SystemHealth = {
    overall: overall as HealthStatus,
    timestamp: new Date().toISOString(),
    dependencies: {
      database: { status: dbStatus, latencyMs: dbLatencyMs },
      redis: { status: redisStatus, latencyMs: redisLatencyMs },
    },
    workers: { running, stale, failed, lastHeartbeatAgeSec },
    jobs: { pending, running: runningJobs, failedLast5m, stuckRunning },
    queue: { depth, oldestJobAgeSec },
    raw: { workersRaw },
  };

  return health;
}
