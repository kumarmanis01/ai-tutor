const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const boardsCount = await prisma.board.count();
  const classCount = await prisma.classLevel.count();
  const subjectCount = await prisma.subjectDef.count();

  console.log('DB SUMMARY:');
  console.log('  boards:', boardsCount);
  console.log('  class_levels:', classCount);
  console.log('  subject_defs:', subjectCount);

  const sampleBoard = await prisma.board.findFirst();
  if (sampleBoard) {
    const classes = await prisma.classLevel.findMany({
      where: { boardId: sampleBoard.id },
      take: 2,
    });
    for (const cl of classes) {
      const subjects = await prisma.subjectDef.findMany({ where: { classId: cl.id }, take: 3 });
      cl.subjectsSample = subjects;
    }
    console.log('\nSAMPLE BOARD (first):');
    console.dir({ board: sampleBoard, classSamples: classes }, { depth: 4 });
  } else {
    console.log('\nNo boards found');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });