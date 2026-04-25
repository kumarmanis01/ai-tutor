#!/usr/bin/env node
import { prisma } from '../lib/prisma';
const jobId = process.argv[2];
if (!jobId) {
  console.error('Usage: node scripts/tmp-child-job-counts.cjs <hydrationJobId>');
  process.exit(2);
}

(async () => {
  try {
    const pkg = require('@prisma/client');
    const { PrismaClient } = pkg;

    const level2Count = await prisma.hydrationJob.count({
      where: { rootJobId: jobId, hierarchyLevel: 2 },
    });
    const level3Count = await prisma.hydrationJob.count({
      where: { rootJobId: jobId, hierarchyLevel: 3 },
    });

    console.log('\nCHILD_JOB_COUNTS for', jobId);
    console.log('Level 2 (notes):', level2Count);
    console.log('Level 3 (questions):', level3Count);

    if (level2Count > 0) {
      const l2 = await prisma.hydrationJob.findMany({
        where: { rootJobId: jobId, hierarchyLevel: 2 },
        take: 100,
      });
      console.log('\nLEVEL2 JOBS:\n', JSON.stringify(l2, null, 2));
    }

    if (level3Count > 0) {
      const l3 = await prisma.hydrationJob.findMany({
        where: { rootJobId: jobId, hierarchyLevel: 3 },
        take: 200,
      });
      console.log('\nLEVEL3 JOBS:\n', JSON.stringify(l3, null, 2));
    }

    await prisma.$disconnect();
  } catch (err) {
    console.error('ERROR querying DB:', err);
    process.exitCode = 1;
  }
})();
