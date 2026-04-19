/**
 * Quick local check to reproduce the Prisma grade-type error.
 * Run with: npx tsx scripts/check-grade-prisma.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Prisma grade check ===');
  try {
    console.log('Querying SubjectDef with string grade ("10")...');
    const res1 = await prisma.subjectDef.findFirst({
      where: {
        slug: 'math',
        lifecycle: 'active',
        class: {
          lifecycle: 'active',
          grade: '10', // intentional string to reproduce the error
          board: {
            lifecycle: 'active',
            slug: { equals: 'cbse', mode: 'insensitive' },
          },
        },
      },
      select: { id: true, name: true },
    });
    console.log('Result (string grade):', res1);
  } catch (e: any) {
    console.error('Error with string grade:', e?.message ?? e);
  }

  try {
    console.log('Querying SubjectDef with numeric grade (10)...');
    const res2 = await prisma.subjectDef.findFirst({
      where: {
        slug: 'math',
        lifecycle: 'active',
        class: {
          lifecycle: 'active',
          grade: 10,
          board: {
            lifecycle: 'active',
            slug: { equals: 'cbse', mode: 'insensitive' },
          },
        },
      },
      select: { id: true, name: true },
    });
    console.log('Result (numeric grade):', res2);
  } catch (e: any) {
    console.error('Error with numeric grade:', e?.message ?? e);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
