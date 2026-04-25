const { prisma } = require('../lib/prisma');

async function main() {
  try {
    const rows = [];
    rows.push(['Board', await prisma.board.count()]);
    rows.push(['SubjectDef', await prisma.subjectDef.count()]);
    rows.push(['ChapterDef', await prisma.chapterDef.count()]);
    rows.push(['TopicDef', await prisma.topicDef.count()]);
    rows.push(['Concept', await prisma.concept.count()]);
    rows.push(['Question', await prisma.question.count()]);
    rows.push(['BoardChapterWeight', await prisma.boardChapterWeight.count()]);
    rows.push(['CurriculumChunk', await prisma.curriculumChunk.count()]);
    rows.push(['Misconception', await prisma.misconception.count()]);

    for (const [label, count] of rows) {
      console.log(`${label}: ${count}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
