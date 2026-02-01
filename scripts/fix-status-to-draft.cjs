/**
 * One-time script: Update all simulated content from 'approved' to 'draft'
 * so the Content Review page shows pending items.
 */
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const chapters = await p.chapterDef.updateMany({
    where: { status: 'approved' },
    data: { status: 'draft' },
  });
  console.log('Chapters updated to draft:', chapters.count);

  const topics = await p.topicDef.updateMany({
    where: { status: 'approved' },
    data: { status: 'draft' },
  });
  console.log('Topics updated to draft:', topics.count);

  const notes = await p.topicNote.updateMany({
    where: { status: 'approved' },
    data: { status: 'draft' },
  });
  console.log('Notes updated to draft:', notes.count);

  const tests = await p.generatedTest.updateMany({
    where: { status: 'approved' },
    data: { status: 'draft' },
  });
  console.log('Tests updated to draft:', tests.count);

  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e.message);
  await p.$disconnect();
  process.exit(1);
});
