import { prisma } from '@/lib/prisma';
import { systemHealth } from './systemHealth';
import { logger } from '@/lib/logger';

type AlertSpec = { type: string; severity: 'INFO' | 'WARNING' | 'CRITICAL'; message: string; payload?: any };

async function emitOrUpdateAlert(spec: AlertSpec) {
  try {
    const existing = await prisma.systemAlert.findFirst({ where: { type: spec.type as any, active: true } });
    if (existing) {
      await prisma.systemAlert.update({ where: { id: existing.id }, data: { lastSeen: new Date(), message: spec.message, payload: spec.payload } });
      return;
    }
    await prisma.systemAlert.create({ data: { type: spec.type as any, severity: spec.severity as any, message: spec.message, payload: spec.payload ?? undefined, active: true } });
  } catch (e) {
    logger?.error?.('emitOrUpdateAlert failed', { err: e, spec });
  }
}

async function resolveAlert(type: string) {
  try {
    const existing = await prisma.systemAlert.findFirst({ where: { type: type as any, active: true } });
    if (!existing) return;
    await prisma.systemAlert.update({ where: { id: existing.id }, data: { active: false, resolvedAt: new Date() } });
  } catch (e) {
    logger?.error?.('resolveAlert failed', { err: e, type });
  }
}

export async function runWatchdogs() {
  const health = await systemHealth();

  // Redis watchdog
  if (health.dependencies.redis.status === 'unhealthy') {
    await emitOrUpdateAlert({ type: 'REDIS_DOWN', severity: 'CRITICAL', message: 'Redis is unreachable', payload: { redis: health.dependencies.redis } });
  } else {
    await resolveAlert('REDIS_DOWN');
  }

  // DB watchdog
  if (health.dependencies.database.status === 'unhealthy') {
    await emitOrUpdateAlert({ type: 'DB_DOWN', severity: 'CRITICAL', message: 'Database connectivity failure', payload: { database: health.dependencies.database } });
  } else {
    await resolveAlert('DB_DOWN');
  }

  // Worker watchdogs
  if (health.workers.stale > 0) {
    await emitOrUpdateAlert({ type: 'WORKER_STALE', severity: 'WARNING', message: `${health.workers.stale} worker(s) stale`, payload: { workers: health.workers } });
  } else {
    await resolveAlert('WORKER_STALE');
  }

  if (health.workers.failed > 0) {
    await emitOrUpdateAlert({ type: 'WORKER_FAILED', severity: 'CRITICAL', message: `${health.workers.failed} worker(s) failed`, payload: { workers: health.workers } });
  } else {
    await resolveAlert('WORKER_FAILED');
  }

  // Job watchdogs
  if (health.jobs.stuckRunning > 0) {
    await emitOrUpdateAlert({ type: 'JOB_STUCK', severity: 'WARNING', message: `${health.jobs.stuckRunning} job(s) stuck`, payload: { jobs: health.jobs } });
  } else {
    await resolveAlert('JOB_STUCK');
  }

  // Queue backlog
  if (health.queue.depth > 100 || (health.queue.oldestJobAgeSec ?? 0) > 300) {
    await emitOrUpdateAlert({ type: 'QUEUE_BACKLOG', severity: 'WARNING', message: `Queue backlog: ${health.queue.depth}, oldest ${health.queue.oldestJobAgeSec ?? 'N/A'}s`, payload: { queue: health.queue } });
  } else {
    await resolveAlert('QUEUE_BACKLOG');
  }

  return true;
}
