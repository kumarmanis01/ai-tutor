import { prisma } from '@/lib/prisma.js';
import { logger } from '@/lib/logger.js';

export function startWorkerLifecycleWatchdog(opts?: { intervalMs?: number; staleAfterMs?: number }) {
  const intervalMs = opts?.intervalMs ?? 30_000;
  const staleAfterMs = opts?.staleAfterMs ?? 60_000; // consider worker stale if no heartbeat in this many ms

  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  async function checkOnce() {
    try {
      const cutoff = new Date(Date.now() - staleAfterMs);
      const staleWorkers = await prisma.workerLifecycle.findMany({ where: { lastHeartbeatAt: { lt: cutoff }, status: { not: 'FAILED' } } });
      if (staleWorkers.length === 0) return;
      logger.info('watchdog: found stale workers', { count: staleWorkers.length });

      for (const wk of staleWorkers) {
        try {
          await prisma.workerLifecycle.update({ where: { id: wk.id }, data: { status: 'FAILED', stoppedAt: new Date() } });
          await prisma.auditLog.create({ data: { userId: null, action: 'worker_watchdog_mark_failed', details: { workerId: wk.id, prevStatus: wk.status }, createdAt: new Date() } });
          logger.warn('watchdog: marked worker FAILED', { workerId: wk.id, prevStatus: wk.status });
        } catch (e) {
          logger?.error?.('watchdog: failed to mark worker FAILED', { err: e, workerId: wk.id });
        }
      }
    } catch (err) {
      logger?.error?.('watchdog: unexpected error', { err });
    }
  }

  function start() {
    if (timer) return;
    stopped = false;
    timer = setInterval(() => {
      if (stopped) return;
      void checkOnce();
    }, intervalMs);
    // run immediately
    void checkOnce();
    logger.info('watchdog: started', { intervalMs, staleAfterMs });
  }

  function stop() {
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    logger.info('watchdog: stopped');
  }

  return { start, stop, checkOnce };
}
