'use strict';

// Load .env.production when running directly on VPS
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env.production'),
});

/**
 * seed-taxonomy.cjs
 *
 * Seeds structural taxonomy only — no content, no questions, no chunks.
 * Safe to run on production: all operations are upsert-based (idempotent).
 * Existing SubjectDef slugs are never renamed.
 *
 * Usage: node scripts/seed-taxonomy.cjs
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── data constants ───────────────────────────────────────────────────────────

const BOARDS = [
  { name: 'CBSE', slug: 'cbse', description: 'Central Board of Secondary Education' },
  { name: 'ICSE', slug: 'icse', description: 'Indian Certificate of Secondary Education' },
];

// Applied to BOTH boards for all grades 1–12.
const SUBJECT_MATRIX = {
  '1-5':  ['English', 'Hindi', 'Mathematics', 'Environmental Studies'],
  '6-8':  ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science'],
  '9-10': ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Computer Applications'],
  '11-12':['English', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science'],
};

function gradeRange(grade) {
  if (grade <= 5)  return '1-5';
  if (grade <= 8)  return '6-8';
  if (grade <= 10) return '9-10';
  return '11-12';
}

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

// ── phases ───────────────────────────────────────────────────────────────────

async function seedBoards() {
  console.log('[seed-taxonomy] ── Phase 1: Boards ──');
  for (const board of BOARDS) {
    await prisma.board.upsert({
      where: { slug: board.slug },
      update: {}, // never overwrite existing name
      create: { name: board.name, slug: board.slug },
    });
    console.log(`[seed-taxonomy]   Board: ${board.name} ✓`);
  }
}

async function seedClassLevels() {
  console.log('[seed-taxonomy] ── Phase 2: ClassLevels ──');
  const boards = await prisma.board.findMany({ select: { id: true, name: true } });
  for (const board of boards) {
    for (let grade = 1; grade <= 12; grade++) {
      await prisma.classLevel.upsert({
        where: { boardId_grade: { boardId: board.id, grade } },
        update: {},
        create: { boardId: board.id, grade, slug: `grade-${grade}` },
      });
    }
    console.log(`[seed-taxonomy]   ${board.name}: grades 1–12 ✓`);
  }
}

async function seedSubjectDefs() {
  console.log('[seed-taxonomy] ── Phase 3: SubjectDefs ──');
  const classLevels = await prisma.classLevel.findMany({
    select: { id: true, grade: true, board: { select: { name: true } } },
  });
  let total = 0;
  for (const cl of classLevels) {
    const subjects = SUBJECT_MATRIX[gradeRange(cl.grade)];
    for (const name of subjects) {
      // Preserve existing slug — never rename a SubjectDef in production.
      const existing = await prisma.subjectDef.findFirst({
        where: { classId: cl.id, name },
        select: { slug: true },
      });
      const slug = existing ? existing.slug : toSlug(name);
      await prisma.subjectDef.upsert({
        where: { classId_slug: { classId: cl.id, slug } },
        update: {},
        create: { name, slug, classId: cl.id },
      });
      total++;
    }
  }
  console.log(`[seed-taxonomy]   ${total} SubjectDef rows upserted ✓`);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[seed-taxonomy] Starting taxonomy seed...');
  try {
    await seedBoards();
    await seedClassLevels();
    await seedSubjectDefs();

    const [boards, classLevels, subjects] = await Promise.all([
      prisma.board.count(),
      prisma.classLevel.count(),
      prisma.subjectDef.count(),
    ]);

    console.log('[seed-taxonomy]');
    console.log('[seed-taxonomy] ✅ Complete');
    console.log(`[seed-taxonomy]    Boards: ${boards}`);
    console.log(`[seed-taxonomy]    ClassLevels: ${classLevels}`);
    console.log(`[seed-taxonomy]    SubjectDefs: ${subjects}`);
  } catch (err) {
    console.error('[seed-taxonomy] ❌ Failed:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
