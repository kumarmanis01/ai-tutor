require('ts-node/register/transpile-only');
(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const mod = await import('../../lib/alertEvaluator');
    const evaluateAlerts = mod && (mod.default || mod.evaluateAlerts) ? (mod.default || mod.evaluateAlerts) : mod;
    const res = await evaluateAlerts(prisma, { dryRun: true, now: new Date() });
    console.log('direct eval results', JSON.stringify(res));
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('direct eval failed', e);
    try { await prisma.$disconnect(); } catch (er) {}
    process.exit(1);
  }
})();
