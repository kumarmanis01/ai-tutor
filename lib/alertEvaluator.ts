import { PrismaClient, Prisma } from '@prisma/client';

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
  const t0 = opts.now ?? new Date();

  const qThreshold = opts.qThreshold ?? Number(process.env.QUEUE_BACKLOG_THRESHOLD || 50);
  const window5From = new Date(t0.getTime() - 5 * 60 * 1000);
  const window30From = new Date(t0.getTime() - 30 * 60 * 1000);

  const results: any[] = [];

  // QUEUE_BACKLOG
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
  results.push({ rule: 'QUEUE_BACKLOG', decision: decision1, inputs: { cnt5, max30 } });

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

  // QUEUE_OLD_JOB_AGE
  const ageThreshold = opts.ageThreshold ?? Number(process.env.QUEUE_AGE_THRESHOLD || 300);
  const ageWindowFrom = new Date(t0.getTime() - 10 * 60 * 1000);
  const ageRow = await prisma.telemetrySample.findFirst({ where: { key: 'queue.oldest_age_sec.value', timestamp: { gte: ageWindowFrom } }, orderBy: { timestamp: 'desc' } });
  const oldestAge = ageRow ? Number(ageRow.value) : null;
  const decision2 = (oldestAge !== null && oldestAge > ageThreshold) ? 'CRITICAL' : 'OK';
  results.push({ rule: 'QUEUE_OLD_JOB_AGE', decision: decision2, inputs: { oldestAge, ageThreshold } });

  if (!DRY_RUN) {
    // Map this condition to an existing AlertType: use WORKER_STALE to represent very old jobs
    const existing = await prisma.systemAlert.findFirst({ where: { type: 'WORKER_STALE', active: true } });
    if (decision2 !== 'OK') {
      const message = `Oldest job age high: ${oldestAge}s (threshold ${ageThreshold}s)`;
      const payload = { oldestAge, threshold: ageThreshold } as any;
      if (existing) {
        await prisma.systemAlert.update({ where: { id: existing.id }, data: { lastSeen: new Date(), message, payload } });
      } else {
        await prisma.systemAlert.create({ data: { type: 'WORKER_STALE', severity: 'CRITICAL' as any, message, payload } });
      }
    } else if (existing) {
      await prisma.systemAlert.update({ where: { id: existing.id }, data: { active: false, resolvedAt: new Date(), lastSeen: new Date() } });
    }
  }

  // FAILED_JOBS_SPIKE
  const spikeMult = opts.spikeMult ?? Number(process.env.FAILED_SPIKE_MULT || 5);
  const minAbs = opts.minAbs ?? Number(process.env.FAILED_SPIKE_MIN || 5);
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
  results.push({ rule: 'FAILED_JOBS_SPIKE', decision: severity, inputs: { recentSum, baselineAvg, spikeMult } });

  if (!DRY_RUN) {
    const existing = await prisma.systemAlert.findFirst({ where: { type: 'JOB_STUCK', active: true } });
    if (triggered) {
      const message = `Failed jobs spike: recent=${recentSum}, baselineAvg=${baselineAvg.toFixed(2)}`;
      const payload = { recentSum, baselineAvg } as any;
      if (existing) {
        await prisma.systemAlert.update({ where: { id: existing.id }, data: { lastSeen: new Date(), message, payload } });
      } else {
        await prisma.systemAlert.create({ data: { type: 'JOB_STUCK', severity: (recentSum > baselineAvg * spikeMult * 2 ? 'CRITICAL' : 'WARNING') as any, message, payload } });
      }
    } else if (existing) {
      await prisma.systemAlert.update({ where: { id: existing.id }, data: { active: false, resolvedAt: new Date(), lastSeen: new Date() } });
    }
  }

  return results;
}

export default evaluateAlerts;
