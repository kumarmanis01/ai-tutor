const { PrismaClient, SoftDeleteStatus, ApprovalStatus } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const boards = await p.board.findMany({
      where: { lifecycle: SoftDeleteStatus.active },
      orderBy: { name: 'asc' },
      include: {
        classes: {
          where: { lifecycle: SoftDeleteStatus.active },
          orderBy: { grade: 'asc' },
          include: {
            subjects: {
              where: { lifecycle: SoftDeleteStatus.active },
              orderBy: { name: 'asc' },
              include: {
                chapters: {
                  where: { lifecycle: SoftDeleteStatus.active, status: ApprovalStatus.approved },
                  orderBy: { order: 'asc' },
                  include: {
                    topics: {
                      where: { lifecycle: SoftDeleteStatus.active, status: ApprovalStatus.approved },
                      orderBy: { order: 'asc' },
                      select: { id: true, name: true, slug: true, order: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    console.log(JSON.stringify({ boardsCount: boards.length, boards }, null, 2));
  } catch (e) {
    console.error('ERR', e);
    process.exit(1);
  } finally {
    await p.$disconnect();
    process.exit(0);
  }
})();
