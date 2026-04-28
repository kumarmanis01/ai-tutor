/**
 * Verification for Taxonomy & Content Readiness (PreLaunch Gap Analysis Task 1).
 * Run after seed-taxonomy-launch-slice.ts.
 *
 * Checks:
 * - Concepts with null description for launch slice (CBSE Grade 10 Maths + Science).
 * - CurriculumChunk rows with empty conceptIds (if table is in use).
 */
import { prisma } from '../lib/prisma';

async function main() {
  const cbse = await prisma.board.findFirst({ where: { slug: 'cbse' } });
  if (!cbse) {
    console.log('Board CBSE not found.');
    return;
  }
  const class10 = await prisma.classLevel.findFirst({
    where: { boardId: cbse.id, grade: 10 },
    include: {
      subjects: {
        where: {
          slug: { in: ['mathematics', 'physics', 'chemistry', 'biology', 'science'] },
        },
      },
    },
  });
  if (!class10) {
    console.log('CBSE Grade 10 not found.');
    return;
  }
  const subjectIds = class10.subjects.map((s) => s.id);

  const nullDescCount = await prisma.concept.count({
    where: {
      subjectId: { in: subjectIds },
      description: null,
    },
  });
  if (nullDescCount > 0) {
    console.log(`❌ Concepts with NULL description (launch slice): ${nullDescCount}`);
    console.log('   Fix: ensure every concept has description set (e.g. via seed or backfill).');
  } else {
    console.log('✅ All concepts in launch slice have non-null description.');
  }

  const chunkCount = await prisma.curriculumChunk.count();
  const untaggedChunks = await prisma.curriculumChunk.count({
    where: { conceptIds: { equals: [] } },
  });
  if (chunkCount > 0) {
    if (untaggedChunks > 0) {
      console.log(`⚠️ CurriculumChunk: ${untaggedChunks} of ${chunkCount} have empty conceptIds.`);
    } else {
      console.log(`✅ All ${chunkCount} curriculum chunks have conceptIds set.`);
    }
  } else {
    console.log('ℹ️ No CurriculumChunk rows yet (ingestion not run).');
  }

  console.log('\nOptional SQL for manual verification:');
  console.log(
    '  SELECT COUNT(*) FROM "Concept" WHERE "description" IS NULL AND "subjectId" IN (<subjectIds>);'
  );
  console.log('  SELECT COUNT(*) FROM "CurriculumChunk" WHERE cardinality("conceptIds") = 0;');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
