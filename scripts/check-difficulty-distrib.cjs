/**
 * Check difficulty distribution
 */

require('./_env-loader').loadEnv();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('=== DIFFICULTY DISTRIBUTION ===\n');

  const topicId = 'cmner6osn0137hyvfsjtsvlme';

  const difficulties = ['easy', 'medium', 'hard'];

  for (const difficulty of difficulties) {
    const count = await prisma.question.count({
      where: {
        topicId,
        difficulty,
        status: 'ACTIVE',
      },
    });
    
    const questions = await prisma.question.findMany({
      where: {
        topicId,
        difficulty,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        prompt: true,
        difficulty: true,
      },
    });

    console.log(`${difficulty.toUpperCase()}: ${count} questions`);
    for (const q of questions) {
      console.log(`  - ${q.id}: ${q.prompt}`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
