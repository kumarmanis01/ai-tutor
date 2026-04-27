const logger = require('../../lib/logger');
﻿// allow legacy requires in this small helper
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('ts-node/register/transpile-only');

(async () => {
  // allow legacy requires in this small helper
  // eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require('../../lib/prisma');
  
  try {
    await prisma.$connect();
    const mod = await import('../../lib/alertEvaluator');
    const evaluateAlerts = mod && (mod.default || mod.evaluateAlerts) ? (mod.default || mod.evaluateAlerts) : mod;
    const res = await evaluateAlerts(prisma, { dryRun: true, now: new Date() });
    // eslint-disable-next-line no-console
    logger.info('direct eval results', JSON.stringify(res));
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    // eslint-disable-next-line no-console
    logger.error('direct eval failed', e);
    try { await prisma.$disconnect(); } catch {
      // ignore
    }
    process.exit(1);
  }
})();
