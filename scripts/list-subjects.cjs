const { prisma } = require('../lib/prisma');
const p = prisma;

async function main() {
  const subjects = await p.subjectDef.findMany({
    include: { class: { include: { board: true }}}
  });
  
  console.log('=== SUBJECTS ===');
  for (const s of subjects) {
    console.log(JSON.stringify({
      id: s.id,
      name: s.name,
      classId: s.classId,
      boardId: s.class?.boardId
    }));
  }
}

main().catch(console.error).finally(() => p.$disconnect());
