import { prisma } from '../dist/lib/prisma.js';

(async () => {
  try {
    const recent = await prisma.outbox.findMany({
      where: { meta: { path: ['hydrationJobId'], equals: 'cmm994e1o000bt8607idihpv2' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    console.log(JSON.stringify(recent, null, 2));
  } catch (err) {
    console.error('ERROR querying outbox:', err);
    process.exitCode = 1;
  } finally {
    try { await prisma.$disconnect(); } catch {}
  }
})();
