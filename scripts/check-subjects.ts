/**
 * Quick script to list active SubjectDef rows with their class/board.
 * Helps determine why seeder created no mocks.
 */
import { prisma } from '@/lib/prisma';

async function main() {
  try {
    const rows = await prisma.subjectDef.findMany({
      where: { lifecycle: 'active', isAvailable: true },
      include: { class: { include: { board: true } } },
      take: 200,
    });
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('check-subjects failed', String(err));
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('unhandled', e);
  process.exit(3);
});
