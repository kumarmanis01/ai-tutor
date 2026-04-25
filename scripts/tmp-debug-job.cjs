#!/usr/bin/env node
import { prisma } from '../lib/prisma';
const jobId = process.argv[2];
if (!jobId) {
  console.error('Usage: node scripts/tmp-debug-job.cjs <hydrationJobId>');
  process.exit(2);
}

(async () => {
  try {
    const pkg = require('@prisma/client');
    const { PrismaClient } = pkg;

    const hj = await prisma.hydrationJob.findUnique({ where: { id: jobId } });
    console.log('\nHYDRATION_JOB:\n', JSON.stringify(hj, null, 2));

    const chapterCount = await prisma.chapterDef
      .count({ where: { hydrationJobId: jobId } })
      .catch(() => null);
    const topicCount = await prisma.topicDef
      .count({ where: { hydrationJobId: jobId } })
      .catch(() => null);
    console.log('\nCOUNTS: chapters=', chapterCount, ' topics=', topicCount);

    let topics = [];
    if (hj && hj.subjectId) {
      topics = await prisma.topicDef.findMany({
        where: { chapter: { subjectId: hj.subjectId }, lifecycle: 'active' },
        take: 200,
      });
      console.log('\nTOPICS_FOR_SUBJECT count=', topics.length);
      console.log(
        JSON.stringify(
          topics.map((t) => ({ id: t.id, title: t.title, chapterId: t.chapterId })),
          null,
          2
        )
      );
    } else {
      console.log('\nNo subjectId on root job; skipping topic query');
    }

    const recent = await prisma.outbox.findMany({
      where: { meta: { path: ['hydrationJobId'], equals: jobId } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    console.log('\nRECENT_OUTBOX (20): count=', recent.length);
    console.log(JSON.stringify(recent, null, 2));

    await prisma.$disconnect();
  } catch (err) {
    console.error('ERROR querying DB:', err);
    process.exitCode = 1;
  }
})();
