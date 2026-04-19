// Simple script to list boards via Prisma (for debugging)
const { prisma } = require('../lib/prisma');
const p = prisma;

(async () => {
  try {
    const boards = await p.board.findMany({ select: { id: true, name: true, slug: true } });
    console.log('boards_count=' + boards.length);
    console.log(JSON.stringify(boards, null, 2));
  } catch (e) {
    console.error('ERR', e);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
