/* eslint-disable */
import { PrismaClient } from '@prisma/client';
import evaluateAlerts from '@/lib/alertEvaluator.js';

(async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('Skipping integration tests: DATABASE_URL not set');
    process.exit(0);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const now = new Date();

    // Cleanup any leftover alerts of our test types
    await prisma.systemAlert.deleteMany({ where: { type: { in: ['QUEUE_BACKLOG', 'WORKER_STALE', 'JOB_STUCK'] } } }).catch(()=>{});

    // Test 1: Queue backlog warning (3 of last 5 minutes > 50)
    const samples1: any[] = [];
    for (let i = 4; i >= 0; i--) {
      const ts = new Date(now.getTime() - i * 60 * 1000);
      const value = (i === 4 || i === 3 || i === 1) ? 60 : 5; // three high values
      samples1.push({ key: 'queue.depth.value', timestamp: ts, value, dimensionHash: 'int-test' });
    }
    await prisma.telemetrySample.createMany({ data: samples1 });

    await evaluateAlerts(prisma, { dryRun: false, now });

    const alert1 = await prisma.systemAlert.findFirst({ where: { type: 'QUEUE_BACKLOG' } });
    if (!alert1 || alert1.active !== true) throw new Error('Test1 failed: QUEUE_BACKLOG not active');
    console.log('Test1 passed: QUEUE_BACKLOG created and active');

    // Test 2: Resolve - next 5 minutes zero depth
    const samples2: any[] = [];
    for (let i = 0; i < 5; i++) {
      const ts = new Date(now.getTime() + i * 60 * 1000);
      samples2.push({ key: 'queue.depth.value', timestamp: ts, value: 0, dimensionHash: 'int-test-2' });
    }
    await prisma.telemetrySample.createMany({ data: samples2 });

    await evaluateAlerts(prisma, { dryRun: false, now: new Date(now.getTime() + 5 * 60 * 1000) });
    const alertResolved = await prisma.systemAlert.findFirst({ where: { type: 'QUEUE_BACKLOG' } });
    if (alertResolved && alertResolved.active !== false) throw new Error('Test2 failed: QUEUE_BACKLOG not resolved');
    console.log('Test2 passed: QUEUE_BACKLOG resolved');

    // Test 3: Failed jobs spike
    // baseline: 14 minutes of value=1, recent minute value=10
    const baseline: any[] = [];
    for (let i = 15; i >= 2; i--) {
      baseline.push({ key: 'jobs.failed.count', timestamp: new Date(now.getTime() - i * 60 * 1000), value: 1, dimensionHash: 'int-test-3' });
    }
    // recent minute
    baseline.push({ key: 'jobs.failed.count', timestamp: new Date(now.getTime() - 30 * 1000), value: 10, dimensionHash: 'int-test-3' });
    await prisma.telemetrySample.createMany({ data: baseline });

    await evaluateAlerts(prisma, { dryRun: false, now });
    const jobAlert = await prisma.systemAlert.findFirst({ where: { type: 'JOB_STUCK' } });
    if (!jobAlert || jobAlert.active !== true) throw new Error('Test3 failed: JOB_STUCK not active');
    console.log('Test3 passed: JOB_STUCK created and active');

    // cleanup
    await prisma.systemAlert.deleteMany({ where: { type: { in: ['QUEUE_BACKLOG', 'WORKER_STALE', 'JOB_STUCK'] } } }).catch(()=>{});
    await prisma.telemetrySample.deleteMany({ where: { key: { in: ['queue.depth.value', 'jobs.failed.count', 'queue.oldest_age_sec.value'] } } }).catch(()=>{});

    console.log('All integration tests passed');
    process.exit(0);
  } catch (err) {
    console.error('Integration tests failed', err);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }

})();
