/**
 * Evaluate telemetry and create/update system alerts used by integration tests.
 */
import { PrismaClient } from '@prisma/client';

export type EvalOptions = {
  dryRun?: boolean;
  now?: Date;
  qThreshold?: number;
  ageThreshold?: number;
  spikeMult?: number;
  minAbs?: number;
};

export async function evaluateAlerts(prisma: PrismaClient, opts: EvalOptions = {}) {
  const DRY_RUN = opts.dryRun ?? true;
  const now = opts.now ?? new Date();

  // QUEUE_BACKLOG rule
  const qThreshold = opts.qThreshold ?? Number(process.env.QUEUE_BACKLOG_THRESHOLD || 50);
  const window5From = new Date(now.getTime() - 5 * 60 * 1000);
  const window30From = new Date(now.getTime() - 30 * 60 * 1000);

  const cnt5 = await prisma.telemetrySample.count({
    where: {
      key: 'queue.depth.value',
      timestamp: { gte: window5From },
      value: { gt: qThreshold as any }
    }
  });

  const samples30 = await prisma.telemetrySample.findMany({ where: { key: 'queue.depth.value', timestamp: { gte: window30From } }, select: { value: true } });
  const max30 = samples30.length ? Math.max(...samples30.map(s => Number((s as any).value))) : 0;

  const decision1 = (cnt5 >= 3) ? (max30 > Math.max(qThreshold, 200) ? 'CRITICAL' : 'WARNING') : 'OK';

  if (!DRY_RUN) {
    const existing = await prisma.systemAlert.findFirst({ where: { type: 'QUEUE_BACKLOG', active: true } });
    if (decision1 !== 'OK') {
      const severity = decision1 === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
      const message = `Queue backlog: ${cnt5} samples > ${qThreshold} in last 5m; max30=${max30}`;
      const payload = { cnt5, max30, threshold: qThreshold } as any;
      if (existing) {
        await prisma.systemAlert.update({ where: { id: existing.id }, data: { lastSeen: new Date(), message, payload } });
      } else {
        await prisma.systemAlert.create({ data: { type: 'QUEUE_BACKLOG', severity: severity as any, message, payload } });
      }
    } else if (existing) {
      await prisma.systemAlert.update({ where: { id: existing.id }, data: { active: false, resolvedAt: new Date(), lastSeen: new Date() } });
    }
  }

  // FAILED_JOBS_SPIKE rule
  const spikeMult = opts.spikeMult ?? Number(process.env.FAILED_SPIKE_MULT || 5);
  const minAbs = opts.minAbs ?? Number(process.env.FAILED_SPIKE_MIN || 5);
  const recentFrom = new Date(now.getTime() - 1 * 60 * 1000);
  const baselineFrom = new Date(now.getTime() - 15 * 60 * 1000);

  const recentSamples = await prisma.telemetrySample.findMany({ where: { key: 'jobs.failed.count', timestamp: { gte: recentFrom } }, select: { value: true } });
  const recentSum = recentSamples.reduce((s, r) => s + Number((r as any).value), 0);

  const baselineSamples = await prisma.telemetrySample.findMany({ where: { key: 'jobs.failed.count', timestamp: { gte: baselineFrom, lt: recentFrom } }, select: { value: true } });
  const baselineAvg = baselineSamples.length ? (baselineSamples.reduce((s, r) => s + Number((r as any).value), 0) / baselineSamples.length) : 0;

  const triggered = recentSum >= minAbs && (baselineAvg === 0 ? recentSum >= minAbs * spikeMult : recentSum > baselineAvg * spikeMult);

  if (!DRY_RUN) {
    const existing = await prisma.systemAlert.findFirst({ where: { type: 'JOB_STUCK', active: true } });
    if (triggered) {
      const severity = (recentSum > baselineAvg * spikeMult * 2) ? 'CRITICAL' : 'WARNING';
      const message = `Failed jobs spike: recent=${recentSum}, baselineAvg=${baselineAvg.toFixed(2)}`;
      const payload = { recentSum, baselineAvg } as any;
      if (existing) {
        await prisma.systemAlert.update({ where: { id: existing.id }, data: { lastSeen: new Date(), message, payload } });
      } else {
        await prisma.systemAlert.create({ data: { type: 'JOB_STUCK', severity: severity as any, message, payload } });
      }
    } else if (existing) {
      await prisma.systemAlert.update({ where: { id: existing.id }, data: { active: false, resolvedAt: new Date(), lastSeen: new Date() } });
    }
  }

  return [] as any[];
}

export default evaluateAlerts;
