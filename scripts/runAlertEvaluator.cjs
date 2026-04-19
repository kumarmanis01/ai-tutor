#!/usr/bin/env node
/* One-off alert evaluator (CommonJS)
   - Implements rule: QUEUE_BACKLOG
   - Checks TelemetrySample for `queue.depth.value` over 5m and 30m windows
   - Creates or updates SystemAlert rows idempotently
*/
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const now = new Date();
    const window5 = new Date(now.getTime() - 5 * 60 * 1000);
    const window30 = new Date(now.getTime() - 30 * 60 * 1000);

    const threshold = Number(process.env.QUEUE_BACKLOG_THRESHOLD || '50');

    const rows5 = await prisma.telemetrySample.findMany({ where: { key: 'queue.depth.value', timestamp: { gte: window5 } } });
    const rows30 = await prisma.telemetrySample.findMany({ where: { key: 'queue.depth.value', timestamp: { gte: window30 } } });

    const max5 = rows5.length ? Math.max(...rows5.map(r => Number(r.value))) : 0;
    const max30 = rows30.length ? Math.max(...rows30.map(r => Number(r.value))) : 0;

    console.log('QUEUE_BACKLOG check:', { threshold, max5, max30, rows5: rows5.length, rows30: rows30.length });

    if (max5 > threshold) {
      const severity = max30 > threshold ? 'CRITICAL' : 'WARNING';
      const message = `Queue backlog: depth=${max5} (threshold=${threshold})`;
      const payload = { threshold, max5, max30, window5Count: rows5.length, window30Count: rows30.length };

      const existing = await prisma.systemAlert.findFirst({ where: { type: 'QUEUE_BACKLOG', active: true } });
      if (existing) {
        await prisma.systemAlert.update({ where: { id: existing.id }, data: { lastSeen: new Date(), message, payload } });
        console.log('Updated existing SystemAlert', existing.id);
      } else {
        const created = await prisma.systemAlert.create({ data: { type: 'QUEUE_BACKLOG', severity: severity, message, payload: payload, active: true } });
        console.log('Created SystemAlert', created.id);
      }
    } else {
      // resolve if exists
      const existing = await prisma.systemAlert.findFirst({ where: { type: 'QUEUE_BACKLOG', active: true } });
      if (existing) {
        await prisma.systemAlert.update({ where: { id: existing.id }, data: { active: false, resolvedAt: new Date() } });
        console.log('Resolved existing SystemAlert', existing.id);
      } else {
        console.log('No alert triggered; nothing to do.');
      }
    }

    // Rule: QUEUE_OLD_JOB_AGE (use queue.oldest_age_sec.value, threshold default 300s)
    const ageThreshold = Number(process.env.QUEUE_AGE_THRESHOLD || '300');
    const ageWindow = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes lookback
    const ageRows = await prisma.telemetrySample.findMany({ where: { key: 'queue.oldest_age_sec.value', timestamp: { gte: ageWindow } }, orderBy: { timestamp: 'desc' }, take: 1 });
    const oldestAge = ageRows.length ? Number(ageRows[0].value) : null;
    console.log('QUEUE_OLD_JOB_AGE check:', { ageThreshold, oldestAge });
    if (oldestAge !== null && oldestAge > ageThreshold) {
      const message = `Oldest job age high: ${oldestAge}s (threshold ${ageThreshold}s)`;
      const payload = { oldestAge };
      const existingAge = await prisma.systemAlert.findFirst({ where: { type: 'QUEUE_BACKLOG', active: true } });
      if (existingAge) {
        await prisma.systemAlert.update({ where: { id: existingAge.id }, data: { lastSeen: new Date(), message, payload } });
        console.log('Updated existing QUEUE_BACKLOG alert for oldest age', existingAge.id);
      } else {
        const created = await prisma.systemAlert.create({ data: { type: 'QUEUE_BACKLOG', severity: 'CRITICAL', message, payload, active: true } });
        console.log('Created QUEUE_BACKLOG alert for oldest age', created.id);
      }
    }

    // Rule: FAILED_JOBS_SPIKE (compare last 1m failed jobs vs 15m baseline)
    const spikeMultiplier = Number(process.env.FAILED_SPIKE_MULT || '5');
    const minAbsolute = Number(process.env.FAILED_SPIKE_MIN || '5');
    const now1m = new Date(now.getTime() - 1 * 60 * 1000);
    const now15m = new Date(now.getTime() - 15 * 60 * 1000);
    const recentFailed = await prisma.telemetrySample.findMany({ where: { key: 'jobs.failed.count', timestamp: { gte: now1m } } });
    const baselineRows = await prisma.telemetrySample.findMany({ where: { key: 'jobs.failed.count', timestamp: { gte: now15m, lt: now1m } } });
    const recentSum = recentFailed.reduce((s, r) => s + Number(r.value), 0);
    const baselineAvg = baselineRows.length ? (baselineRows.reduce((s, r) => s + Number(r.value), 0) / baselineRows.length) : 0;
    console.log('FAILED_JOBS_SPIKE check:', { recentSum, baselineAvg, spikeMultiplier, minAbsolute });
    if (recentSum >= minAbsolute && (baselineAvg === 0 ? recentSum >= minAbsolute * spikeMultiplier : recentSum > baselineAvg * spikeMultiplier)) {
      const severity = recentSum > baselineAvg * spikeMultiplier * 2 ? 'CRITICAL' : 'WARNING';
      const message = `Failed jobs spike: recent=${recentSum}, baselineAvg=${baselineAvg.toFixed(2)}`;
      const payload = { recentSum, baselineAvg };
      const existingFail = await prisma.systemAlert.findFirst({ where: { type: 'JOB_STUCK', active: true } });
      if (existingFail) {
        await prisma.systemAlert.update({ where: { id: existingFail.id }, data: { lastSeen: new Date(), message, payload } });
        console.log('Updated existing JOB_STUCK alert', existingFail.id);
      } else {
        const created = await prisma.systemAlert.create({ data: { type: 'JOB_STUCK', severity, message, payload, active: true } });
        console.log('Created JOB_STUCK alert', created.id);
      }
    }
  } catch (e) {
    console.error('Evaluator failure', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
