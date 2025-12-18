import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { systemHealth } from '@/lib/systemHealth';

/**
 * Persist a sampled system health snapshot to the database.
 * Intended to be called periodically (cron/worker).
 */
export async function sampleSystemHealth() {
  const health = await systemHealth();

  // Persist a compacted sample
  await prisma.systemMetricSample.create({
    data: {
      overall: health.overall,
      timestamp: new Date(health.timestamp),
      dbLatencyMs: health.dependencies.database.latencyMs ? Math.round(health.dependencies.database.latencyMs) : undefined,
      redisLatencyMs: health.dependencies.redis.latencyMs ? Math.round(health.dependencies.redis.latencyMs) : undefined,
      workersRunning: health.workers.running,
      workersStale: health.workers.stale,
      workersFailed: health.workers.failed,
      jobsPending: health.jobs.pending,
      jobsRunning: health.jobs.running,
      jobsFailedLast5m: health.jobs.failedLast5m,
      jobsStuckRunning: health.jobs.stuckRunning,
      queueDepth: health.queue.depth,
      queueOldestJobAge: health.queue.oldestJobAgeSec ?? undefined,
      meta: health as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function queryMetricSamples(from: Date, to: Date) {
  // Query samples within range; return as-is for now — aggregation can be done in the API layer
  const rows = await prisma.systemMetricSample.findMany({ where: { timestamp: { gte: from, lte: to } }, orderBy: { timestamp: 'asc' } });
  return rows;
}
