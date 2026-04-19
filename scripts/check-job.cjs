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
    return;
  }

  console.log('=== Latest Root HydrationJob ===');
  console.log('ID:', job.id);
  console.log('Status:', job.status);
  console.log('Subject:', job.subject, '| SubjectId:', job.subjectId);
  console.log('Board:', job.board, '| Grade:', job.grade);
  console.log('Chapters:', job.chaptersCompleted + '/' + job.chaptersExpected);
  console.log('Topics:', job.topicsCompleted + '/' + job.topicsExpected);
  console.log('Notes:', job.notesCompleted + '/' + job.notesExpected);
  console.log('Questions:', job.questionsCompleted + '/' + job.questionsExpected);

  if (job.subjectId) {
    const chapters = await p.chapterDef.findMany({
      where: { subjectId: job.subjectId },
      orderBy: { order: 'asc' },
    });
    console.log('\n=== Chapters Created ===');
    console.log('Count:', chapters.length);
    for (const c of chapters) {
      const topics = await p.topicDef.findMany({
        where: { chapterId: c.id },
        orderBy: { order: 'asc' },
      });
      console.log('  Chapter:', c.name, '(' + c.status + ') -', topics.length, 'topics');
      for (const t of topics) console.log('    -', t.name);
    }

    const notes = await p.topicNote.count({
      where: { topic: { chapter: { subjectId: job.subjectId } } },
    });
    const questions = await p.generatedQuestion.count({
      where: { test: { topic: { chapter: { subjectId: job.subjectId } } } },
    });
    console.log('\n=== Content Summary ===');
    console.log('Notes:', notes);
    console.log('Questions:', questions);
  }

  // Check child HydrationJobs
  const children = await p.hydrationJob.findMany({
    where: { rootJobId: job.id },
    orderBy: { hierarchyLevel: 'asc' },
  });
  console.log('\n=== Child Jobs ===');
  console.log('Count:', children.length);
  const byLevel = {};
  for (const c of children) {
    const key = 'Level ' + c.hierarchyLevel;
    if (!byLevel[key]) byLevel[key] = { total: 0, completed: 0, pending: 0, running: 0, failed: 0 };
    byLevel[key].total++;
    byLevel[key][c.status]++;
  }
  for (const [level, counts] of Object.entries(byLevel)) {
    console.log(' ', level + ':', JSON.stringify(counts));
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
