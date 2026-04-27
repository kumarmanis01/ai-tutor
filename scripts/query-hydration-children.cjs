require('dotenv').config({ path: '.env.local' });
const { prisma } = require('../lib/prisma');
const p = prisma;

async function main() {
  const rootId = process.argv[2];
  if (!rootId) {
    console.error('Usage: node scripts/query-hydration-children.cjs <rootJobId>');
    process.exit(2);
  }

  const jobs = await p.hydrationJob.findMany({
    where: { OR: [{ rootJobId: rootId }, { id: rootId }] },
    orderBy: { hierarchyLevel: 'asc' },
    take: 200,
  });

  console.log('HydrationJobs for rootId:', rootId);
  for (const j of jobs) {
    console.log('---');
    console.log('id:', j.id);
    console.log('jobType:', j.jobType);
    console.log('hierarchyLevel:', j.hierarchyLevel);
    console.log('status:', j.status);
    console.log('contentReady:', j.contentReady);
    console.log('chaptersExpected:', j.chaptersExpected || 0);
    console.log('chaptersCompleted:', j.chaptersCompleted || 0);
    console.log('lastError:', j.lastError || null);
    console.log('createdAt:', j.createdAt);
  }

  await p.$disconnect();
}

main().catch(async (e) => {
  console.error('ERROR:', e && e.message ? e.message : e);
  try { await p.$disconnect(); } catch (_err) {}
  process.exit(1);
});
