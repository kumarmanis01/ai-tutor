const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    console.log(JSON.stringify({ DATABASE_URL: process.env.DATABASE_URL }));
    const boards = await p.board.findMany({ select: { id: true, name: true, slug: true, lifecycle: true } });
    console.log(JSON.stringify({ boardsCount: boards.length, boards }, null, 2));
  } catch (e) {
    console.error('ERR', e);
    process.exit(1);
  } finally {
    await p.$disconnect();
    process.exit(0);
  }
})();
