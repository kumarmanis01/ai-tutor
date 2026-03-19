const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function seed() {
  const board = await p.board.findFirst({ where: { slug: 'cbse' } });
  if (!board) {
    const all = await p.board.findMany({ select: { slug: true, name: true } });
    console.log('No cbse board. Found:', JSON.stringify(all));
    return;
  }
  console.log('Board:', board.name, board.id);
  for (let g = 1; g <= 12; g++) {
    const r = await p.classLevel.upsert({
      where: { boardId_grade: { boardId: board.id, grade: g } },
      update: {},
      create: { boardId: board.id, grade: g, slug: 'grade-' + g }
    });
    console.log('Grade', g, r.id);
  }
}
seed().catch(console.error).finally(() => p.$disconnect());
