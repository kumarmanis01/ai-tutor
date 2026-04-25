#!/usr/bin/env node
import { prisma } from '../lib/prisma';
async function main() {
  const subjectId = process.argv[2];
  if (!subjectId) {
    console.error('Usage: node scripts/dump-chapters.js <subjectId>');
    process.exit(2);
  }

  try {
    const chapters = await prisma.chapterDef.findMany({
      where: { subjectId },
      orderBy: { order: 'asc' },
      take: 100,
    });
    console.log(
      'Chapters:',
      JSON.stringify(
        chapters.map((c) => ({ id: c.id, name: c.name, order: c.order })),
        null,
        2
      )
    );
  } catch (e) {
    console.error('err', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main();
