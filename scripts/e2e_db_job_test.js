(async () => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const board = await prisma.board.findFirst({ where: { lifecycle: 'active' }, include: { classes: true } });
    if (!board) throw new Error('No active board found');
    console.log('Board:', board.name, board.id);

    const classObj = (board.classes && board.classes[0]) || null;
    if (!classObj) throw new Error('No class found on board');
    console.log('Class:', classObj.grade, classObj.id);

    const subject = await prisma.subjectDef.findFirst({ where: { classId: classObj.id, lifecycle: 'active' }, include: { chapters: true } });
    if (!subject) throw new Error('No subject found');
    console.log('Subject:', subject.name, subject.id);

    // create ExecutionJob directly
    const job = await prisma.executionJob.create({
      data: {
        jobType: 'syllabus',
        entityType: 'SUBJECT',
        entityId: subject.id,
        payload: { reason: 'e2e-db-test' },
        status: 'pending',
        maxAttempts: 3,
      },
    });

    console.log('Created ExecutionJob:', { id: job.id, jobType: job.jobType, status: job.status });
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('E2E DB failed:', err);
    process.exit(1);
  }
})();
