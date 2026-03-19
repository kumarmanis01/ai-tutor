const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seed() {
  try {
    const board = await prisma.board.findFirst({
      where: { slug: 'cbse' }
    });

    if (!board) {
      const allBoards = await prisma.board.findMany({
        select: { slug: true, name: true }
      });

      console.log('No cbse board found.');
      console.log('Existing boards:', JSON.stringify(allBoards, null, 2));
      return;
    }

    console.log(`Board found: ${board.name} (${board.id})`);

    for (let grade = 1; grade <= 12; grade++) {
      const result = await prisma.classLevel.upsert({
        where: {
          boardId_grade: {
            boardId: board.id,
            grade: grade
          }
        },
        update: {},
        create: {
          boardId: board.id,
          grade: grade,
          slug: `grade-${grade}`
        }
      });

      console.log(`Grade ${grade} → ${result.id}`);
    }

    console.log("✅ Class levels seeded successfully.");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();