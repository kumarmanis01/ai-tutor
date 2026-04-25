/**
 * FILE OBJECTIVE:
 * - Seed BoardChapterWeight for ALL active chapters across ALL boards (CBSE + ICSE),
 *   grades 6-12, and subjects, using equal-distribution of 80 theory marks as a default.
 * - Support idempotent create-only, force-overwrite, and dry-run execution modes.
 *
 * LINKED UNIT TEST:
 * - None (seed script; verified by --dry-run output against live DB).
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-04-20T00:00:00Z | claude | created -- full-coverage seed for all boards/grades/subjects
 *
 * Usage:
 *   npx tsx scripts/seed-board-chapter-weights.ts            # create-only (skip existing)
 *   npx tsx scripts/seed-board-chapter-weights.ts --force    # overwrite existing rows
 *   npx tsx scripts/seed-board-chapter-weights.ts --dry-run  # report without writing
 *
 * Run after: seed-taxonomy.cjs (Board/ClassLevel/SubjectDef/ChapterDef must exist).
 * Default marks: 80 / chapter count per subject (minimum 1). Replace with official
 * marking-scheme figures via direct DB update or --force after editing this script.
 */

import { prisma } from '../lib/prisma';

const THEORY_MARKS_PER_SUBJECT = 80;
const MIN_MARKS_PER_CHAPTER = 1;

const isDryRun = process.argv.includes('--dry-run');
const isForce = process.argv.includes('--force');

interface SubjectSummary {
  board: string;
  grade: number;
  subject: string;
  chapters: number;
  marksEach: number;
  created: number;
  skipped: number;
  updated: number;
}

async function seedBoardChapterWeights(): Promise<void> {
  console.log(
    `\nBoardChapterWeight seed -- ${isDryRun ? 'DRY RUN (no writes)' : isForce ? 'FORCE (overwrite existing)' : 'CREATE only (skip existing)'}`
  );
  console.log('Fetching chapters from all active boards, grades 6-12...\n');

  const boards = await prisma.board.findMany({
    where: { slug: { in: ['cbse', 'icse'] }, lifecycle: 'active' },
    select: {
      slug: true,
      classes: {
        where: { grade: { gte: 6, lte: 12 } },
        select: {
          grade: true,
          subjects: {
            where: { lifecycle: 'active', isAvailable: true },
            select: {
              id: true,
              name: true,
              slug: true,
              chapters: {
                where: { lifecycle: 'active' },
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      },
    },
  });

  if (!boards.length) {
    throw new Error('No active CBSE/ICSE boards found. Run seed-taxonomy.cjs first.');
  }

  // Collect all existing chapterId rows to avoid unnecessary upserts
  const existingRows = await prisma.boardChapterWeight.findMany({ select: { chapterId: true } });
  const existingSet = new Set(existingRows.map((r) => r.chapterId));

  const summaries: SubjectSummary[] = [];
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalUpdated = 0;

  for (const board of boards) {
    for (const cls of board.classes) {
      for (const subj of cls.subjects) {
        const chapters = subj.chapters;
        if (!chapters.length) continue;

        const marksEach = Math.max(
          MIN_MARKS_PER_CHAPTER,
          Math.round(THEORY_MARKS_PER_SUBJECT / chapters.length)
        );

        let created = 0;
        let skipped = 0;
        let updated = 0;

        for (const ch of chapters) {
          const alreadyExists = existingSet.has(ch.id);

          if (alreadyExists && !isForce) {
            skipped++;
            continue;
          }

          if (!isDryRun) {
            await prisma.boardChapterWeight.upsert({
              where: { chapterId: ch.id },
              update: isForce ? { weightMarks: marksEach } : {},
              create: { chapterId: ch.id, weightMarks: marksEach },
            });
          }

          if (alreadyExists) {
            updated++;
          } else {
            created++;
            existingSet.add(ch.id);
          }
        }

        totalCreated += created;
        totalSkipped += skipped;
        totalUpdated += updated;

        summaries.push({
          board: board.slug.toUpperCase(),
          grade: cls.grade,
          subject: subj.name,
          chapters: chapters.length,
          marksEach,
          created,
          skipped,
          updated,
        });
      }
    }
  }

  // Print summary table
  console.log(
    'Board'.padEnd(6) +
      'Grade'.padEnd(7) +
      'Subject'.padEnd(24) +
      'Chapters'.padEnd(10) +
      'Marks ea.'.padEnd(11) +
      'Created'.padEnd(9) +
      'Updated'.padEnd(9) +
      'Skipped'
  );
  console.log('-'.repeat(80));
  for (const s of summaries) {
    console.log(
      s.board.padEnd(6) +
        String(s.grade).padEnd(7) +
        s.subject.slice(0, 22).padEnd(24) +
        String(s.chapters).padEnd(10) +
        String(s.marksEach).padEnd(11) +
        String(s.created).padEnd(9) +
        String(s.updated).padEnd(9) +
        String(s.skipped)
    );
  }
  console.log('-'.repeat(80));
  console.log(`Total: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped`);

  if (isDryRun) {
    console.log('\nDry-run complete -- no rows written.');
  } else {
    console.log('\nDone. BoardChapterWeight rows are live.');
    console.log('Note: marks are equally distributed defaults (80 / chapter count).');
    console.log('Replace individual rows with official marking-scheme figures when available.');
  }
}

seedBoardChapterWeights()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
