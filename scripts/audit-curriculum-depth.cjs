#!/usr/bin/env node
/**
 * FILE OBJECTIVE:
 * - Audit curriculum depth for launch-readiness.
 * - Counts subjects, chapters, topics, questions and generated tests per topic.
 * - Emits warnings for shallow content and exits non-zero for fatal gaps.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/audit-curriculum-depth.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-23T00:00:00Z | copilot | created audit script
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting curriculum depth audit...');

  const boards = await prisma.board.findMany();
  if (!boards || boards.length === 0) {
    console.warn('No boards found in the database. Is this the correct DATABASE_URL?');
    await prisma.$disconnect();
    process.exit(1);
  }

  let fatal = false;

  for (const board of boards) {
    console.log(`\nBoard: ${board.name} (slug=${board.slug})`);

    const classLevels = await prisma.classLevel.findMany({ where: { boardId: board.id } });
    if (!classLevels || classLevels.length === 0) {
      console.warn(`  WARN: No class levels found for board ${board.slug}`);
      continue;
    }

    for (const cls of classLevels) {
      console.log(`  Grade: ${cls.grade}`);

      const subjects = await prisma.subjectDef.findMany({ where: { classId: cls.id } });
      console.log(`    Subjects: ${subjects.length}`);
      if (subjects.length === 0) console.warn(`    WARN: No subjects for grade ${cls.grade}`);

      for (const subject of subjects) {
        const chapters = await prisma.chapterDef.findMany({ where: { subjectId: subject.id }, orderBy: { order: 'asc' } });
        console.log(`    Subject: ${subject.name} -- Chapters: ${chapters.length}`);
        if (chapters.length < 2) console.warn(`      WARN: Subject ${subject.name} has <2 chapters (${chapters.length})`);
        if (chapters.length === 0) {
          fatal = true;
          console.error(`      FATAL: Subject ${subject.name} has zero chapters`);
        }

        for (const chapter of chapters) {
          const topics = await prisma.topicDef.findMany({ where: { chapterId: chapter.id }, orderBy: [{ order: 'asc' }] });
          console.log(`      Chapter: ${chapter.name} -- Topics: ${topics.length}`);
          if (topics.length < 5) console.warn(`        WARN: Chapter ${chapter.name} has <5 topics (${topics.length})`);
          if (topics.length === 0) {
            fatal = true;
            console.error(`        FATAL: Chapter ${chapter.name} has zero topics`);
            continue;
          }

          for (const topic of topics) {
            const qCount = await prisma.question.count({ where: { topicId: topic.id } });
            const genCount = await prisma.generatedTest.count({ where: { topicId: topic.id } }).catch(() => 0);
            console.log(`        Topic: ${topic.name} -- Questions: ${qCount} -- GeneratedTests: ${genCount}`);
            if (qCount < 5) console.warn(`          WARN: Topic ${topic.name} has <5 questions (${qCount})`);
            if (genCount === 0) console.warn(`          WARN: Topic ${topic.name} is missing GeneratedTest`);
            if (qCount === 0) {
              fatal = true;
              console.error(`          FATAL: Topic ${topic.name} has zero questions`);
            }
          }
        }
      }
    }
  }

  await prisma.$disconnect();

  if (fatal) {
    console.error('\nAudit FAILED: fatal curriculum gaps detected.');
    process.exit(1);
  }

  console.log('\nAudit completed -- no fatal issues detected.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Audit failed with error:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
