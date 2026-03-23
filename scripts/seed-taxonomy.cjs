'use strict';

// Load .env.production when running directly on VPS
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env.production'),
});

/**
 * seed-taxonomy.cjs
 *
 * Seeds structural taxonomy only -- no content, no questions, no chunks.
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

// ─────────────────────────────────────────────────────────────────────────────
// CBSE Subject Matrix — verified against NCERT 2024-25 textbook availability
//
// Design rules:
//   1. Only subjects with actual NCERT textbooks (or high CBSE demand) listed
//   2. mvp:true  = content generated at launch
//      mvp:false = row seeded but no content yet (content deferred)
//   3. Grades 1-5 seeded but content deprioritised below 6-12
//   4. Gr11-12 defaults to Science stream (JEE/NEET — 70% of demand)
//      Commerce + Humanities streams added via admin after stream selection
//      is implemented in onboarding (post-launch backlog)
// ─────────────────────────────────────────────────────────────────────────────
const SUBJECT_MATRIX = {

  // ── Grades 1–2: Foundational stage (NEP 2020) ──────────────────────────
  '1-2': [
    { name: 'English',               slug: 'english',               hasNCERT: true,  mvp: false },
    { name: 'Hindi',                 slug: 'hindi',                 hasNCERT: true,  mvp: false },
    { name: 'Mathematics',           slug: 'mathematics',           hasNCERT: true,  mvp: false },
    { name: 'Environmental Studies', slug: 'environmental-studies', hasNCERT: true,  mvp: false },
  ],

  // ── Grades 3–5: Preparatory stage ────────────────────────────────────────
  '3-5': [
    { name: 'English',               slug: 'english',               hasNCERT: true,  mvp: false },
    { name: 'Hindi',                 slug: 'hindi',                 hasNCERT: true,  mvp: false },
    { name: 'Mathematics',           slug: 'mathematics',           hasNCERT: true,  mvp: false },
    { name: 'Environmental Studies', slug: 'environmental-studies', hasNCERT: true,  mvp: false },
  ],

  // ── Grades 6–8: Middle school ─────────────────────────────────────────────
  // NCERT 2024: Curiosity (Science), Ganita Prakash (Maths),
  //             Exploring Society (Social Science), Poorvi (English)
  '6-8': [
    { name: 'English',        slug: 'english',        hasNCERT: true,  mvp: true  },
    { name: 'Hindi',          slug: 'hindi',          hasNCERT: true,  mvp: true  },
    { name: 'Mathematics',    slug: 'mathematics',    hasNCERT: true,  mvp: true  },
    { name: 'Science',        slug: 'science',        hasNCERT: true,  mvp: true  },
    { name: 'Social Science', slug: 'social-science', hasNCERT: true,  mvp: true  },
    { name: 'Sanskrit',       slug: 'sanskrit',       hasNCERT: true,  mvp: false },
    { name: 'Urdu',           slug: 'urdu',           hasNCERT: true,  mvp: false },
  ],

  // ── Grades 9–10: Secondary (board exam) ──────────────────────────────────
  '9-10': [
    { name: 'English',                 slug: 'english',                  hasNCERT: true,  mvp: true  },
    { name: 'Hindi',                   slug: 'hindi',                    hasNCERT: true,  mvp: true  },
    { name: 'Mathematics',             slug: 'mathematics',              hasNCERT: true,  mvp: true  },
    { name: 'Science',                 slug: 'science',                  hasNCERT: true,  mvp: true  },
    { name: 'Social Science',          slug: 'social-science',           hasNCERT: true,  mvp: true  },
    { name: 'Sanskrit',                slug: 'sanskrit',                 hasNCERT: true,  mvp: false },
    { name: 'Information Technology',  slug: 'information-technology',   hasNCERT: false, mvp: false },
    { name: 'Artificial Intelligence', slug: 'artificial-intelligence',  hasNCERT: false, mvp: false },
  ],

  // ── Grades 11–12: Science stream (JEE/NEET — highest demand) ─────────────
  // Commerce + Humanities: seeded separately post-launch via stream selection
  '11-12-science': [
    { name: 'English',            slug: 'english',          hasNCERT: true,  mvp: true  },
    { name: 'Physics',            slug: 'physics',          hasNCERT: true,  mvp: true  },
    { name: 'Chemistry',          slug: 'chemistry',        hasNCERT: true,  mvp: true  },
    { name: 'Mathematics',        slug: 'mathematics',      hasNCERT: true,  mvp: true  },
    { name: 'Biology',            slug: 'biology',          hasNCERT: true,  mvp: true  },
    { name: 'Computer Science',   slug: 'computer-science', hasNCERT: true,  mvp: false },
    { name: 'Physical Education', slug: 'physical-education', hasNCERT: false, mvp: false },
  ],
};

function gradeRange(grade) {
  if (grade <= 2)  return '1-2';
  if (grade <= 5)  return '3-5';
  if (grade <= 8)  return '6-8';
  if (grade <= 10) return '9-10';
  return '11-12-science'; // Science stream default; other streams added post-launch
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
    console.log(`[seed-taxonomy]   ${board.name}: grades 1-12 ✓`);
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
    for (const subj of subjects) {
      // Preserve existing slug -- never rename a SubjectDef in production.
      const existing = await prisma.subjectDef.findFirst({
        where: { classId: cl.id, name: subj.name },
        select: { slug: true },
      });
      const slug = existing ? existing.slug : subj.slug;
      await prisma.subjectDef.upsert({
        where: { classId_slug: { classId: cl.id, slug } },
        update: {},
        create: { name: subj.name, slug, classId: cl.id },
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
