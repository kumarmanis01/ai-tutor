/**
 * Quick script to print MockExam counts grouped by subjectId, grade, board.
 * Used to verify seeder results.
 */
import { prisma } from '@/lib/prisma';

async function main() {
  try {
    const rows = await prisma.mockExam.groupBy({
      by: ['subjectId', 'grade', 'board'],
      _count: { id: true },
    });
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('check-mocks failed', String(err));
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('unhandled', e);
  process.exit(3);
});
