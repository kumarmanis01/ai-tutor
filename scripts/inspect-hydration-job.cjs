require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const job = await p.hydrationJob.findFirst({
    where: { rootJobId: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!job) {
    console.log('No root HydrationJob found.');
    await p.$disconnect();
    return;
  }

  console.log('=== HYDRATION JOB ===');
  console.log(JSON.stringify({
    id: job.id,
    jobType: job.jobType,
    status: job.status,
    lastError: job.lastError,
    estimatedCostUsd: job.estimatedCostUsd,
    actualCostUsd: job.actualCostUsd,
    board: job.board,
    grade: job.grade,
    subject: job.subject,
    subjectId: job.subjectId,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  }, null, 2));

  console.log('\n=== AI CONTENT LOGS (latest 20) ===');
  const logs = await p.aiContentLog.findMany({
    where: { hydrationJobId: job.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  console.log('count:', logs.length);
  console.log(JSON.stringify(logs, null, 2));

  console.log('\n=== CHAPTERS FOR SUBJECT ===');
  if (job.subjectId) {
    const chapters = await p.chapterDef.findMany({
      where: { subjectId: job.subjectId },
      orderBy: { order: 'asc' },
    });
    console.log('count:', chapters.length);
    console.log(JSON.stringify(chapters, null, 2));

    const topics = await p.topicDef.findMany({
      where: { chapter: { subjectId: job.subjectId } },
      orderBy: { order: 'asc' },
      take: 100,
    });
    console.log('\nTopics count (sample up to 100):', topics.length);
    console.log(JSON.stringify(topics.slice(0, 100), null, 2));
  }

  console.log('\n=== CHILD JOBS ===');
  const children = await p.hydrationJob.findMany({ where: { rootJobId: job.id }, orderBy: { hierarchyLevel: 'asc' } });
  console.log('count:', children.length);
  console.log(JSON.stringify(children, null, 2));

  await p.$disconnect();
}

main().catch(async (e) => {
  console.error('ERROR:', e && e.message ? e.message : e);
  try { await p.$disconnect(); } catch (err) {}
  process.exit(1);
});
