#!/usr/bin/env node
import { prisma } from '../lib/prisma';
const jobId = process.argv[2];
if (!jobId) {
  console.error('Usage: node scripts/tmp-fetch-aicontent.cjs <hydrationJobId>');
  process.exit(2);
}
const pkg = require('@prisma/client');
const { PrismaClient } = pkg;
(async () => {
  try {
    const logs = await prisma.aIContentLog.findMany({
      where: { requestBody: { path: ['jobId'], equals: jobId } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    console.log('AI_CONTENT_LOGS count=', logs.length);
    for (const l of logs) {
      console.log('\nLOG id=', l.id, ' status=', l.status, ' error=', l.error);
      console.log('requestBody:', JSON.stringify(l.requestBody));
      console.log('responseBody:', JSON.stringify(l.responseBody));
    }
    await prisma.$disconnect();
  } catch (err) {
    console.error('ERROR:', err);
    process.exitCode = 1;
  }
})();
