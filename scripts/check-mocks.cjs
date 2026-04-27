'use strict';const { prisma } = require('../lib/prisma');


(async () => {
  try {
    const rows = await prisma.mockExam.groupBy({
      by: ['subjectId', 'grade', 'board'],
      _count: { id: true },
    });
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('check-mocks.cjs failed', String(err));
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
})();
