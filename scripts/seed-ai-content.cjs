// CommonJS port of scripts/seed-ai-content.ts (idempotent academic taxonomy seeding)
const fs = require('fs');
const path = require('path');

// Load .env.local/.env into process.env for local script runs (set defaults only)
function loadEnvFileIfPresent() {
  try {
    const root = path.resolve(__dirname, '..');
    const candidates = ['.env.local', '.env'];
    for (const name of candidates) {
      const p = path.join(root, name);
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf8');
      const lines = raw.split(/\r?\n/);
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([^=\s]+)=((?:\".*\")|(?:'.*')|.*)$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2];
        // strip quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (typeof process.env[key] === 'undefined' || process.env[key] === '') {
          process.env[key] = val;
        }
      }
      console.log(`[env-loader] loaded ${p}`);
      break;
    }
  } catch (e) {
    console.warn('[env-loader] failed to load .env file', e && e.message);
  }
}

loadEnvFileIfPresent();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BOARDS = [
  {
    name: 'CBSE',
    slug: 'cbse',
    classes: [
      {
        grade: 1,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Hindi', slug: 'hindi' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Environmental Studies', slug: 'evs' },
          { name: 'Art Education', slug: 'art-education' },
          { name: 'Health & Physical Education', slug: 'physical-education' },
          { name: 'Computer Science', slug: 'computer-science' },
        ],
      },
      { grade: 2, subjects: [] },
      {
        grade: 3,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Hindi', slug: 'hindi' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Environmental Studies', slug: 'evs' },
          { name: 'General Knowledge', slug: 'general-knowledge' },
          { name: 'Art Education', slug: 'art-education' },
          { name: 'Health & Physical Education', slug: 'physical-education' },
          { name: 'Computer Science', slug: 'computer-science' },
        ],
      },
      { grade: 4, subjects: [] },
      { grade: 5, subjects: [] },
      {
        grade: 6,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Hindi', slug: 'hindi' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Science', slug: 'science' },
          { name: 'Social Science', slug: 'social-science' },
          { name: 'Computer Science', slug: 'computer-science' },
        ],
      },
      { grade: 7, subjects: [] },
      { grade: 8, subjects: [] },
      {
        grade: 9,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Physics', slug: 'physics' },
          { name: 'Chemistry', slug: 'chemistry' },
          { name: 'Biology', slug: 'biology' },
          { name: 'History', slug: 'history' },
          { name: 'Geography', slug: 'geography' },
          { name: 'Economics', slug: 'economics' },
          { name: 'Computer Applications', slug: 'computer-applications' },
        ],
      },
      { grade: 10, subjects: [] },
      {
        grade: 11,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Physics', slug: 'physics' },
          { name: 'Chemistry', slug: 'chemistry' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Biology', slug: 'biology' },
          { name: 'Accountancy', slug: 'accountancy' },
          { name: 'Business Studies', slug: 'business-studies' },
          { name: 'Economics', slug: 'economics' },
          { name: 'History', slug: 'history' },
          { name: 'Political Science', slug: 'political-science' },
        ],
      },
      { grade: 12, subjects: [] },
    ],
  },
  {
    name: 'ICSE',
    slug: 'icse',
    classes: [
      {
        grade: 1,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Second Language', slug: 'second-language' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Environmental Studies', slug: 'evs' },
          { name: 'Computer Applications', slug: 'computer-applications' },
          { name: 'Art & Music', slug: 'art-music' },
          { name: 'Physical Education', slug: 'physical-education' },
        ],
      },
      { grade: 2, subjects: [] },
      { grade: 3, subjects: [] },
      { grade: 4, subjects: [] },
      { grade: 5, subjects: [] },
      {
        grade: 9,
        subjects: [
          { name: 'English', slug: 'english' },
          { name: 'Mathematics', slug: 'mathematics' },
          { name: 'Physics', slug: 'physics' },
          { name: 'Chemistry', slug: 'chemistry' },
          { name: 'Biology', slug: 'biology' },
          { name: 'History Civics & Geography', slug: 'history-civics-geography' },
          { name: 'Computer Applications', slug: 'computer-applications' },
        ],
      },
      { grade: 10, subjects: [] },
    ],
  },
];

async function main() {
  console.log('🌱 [START] Academic base seeding initiated...');

  for (const boardSeed of BOARDS) {
    console.log(`➡️  [STEP] Processing board: ${boardSeed.name} (${boardSeed.slug})`);
    const board = await prisma.board.upsert({
      where: { slug: boardSeed.slug },
      update: {},
      create: { name: boardSeed.name, slug: boardSeed.slug },
    });
    console.log(`✅ [BOARD] Board upserted: ${board.name} (slug: ${board.slug})`);

    // Normalize classes
    const classMap = new Map();
    for (const cs of boardSeed.classes) {
      if (!cs || typeof cs.grade !== 'number') continue;
      if (!classMap.has(cs.grade)) classMap.set(cs.grade, cs.subjects || []);
    }

    const normalizedClasses = [];
    let previousSubjects = [];
    for (let grade = 1; grade <= 12; grade++) {
      const raw = classMap.get(grade) || [];
      const use = raw.length > 0 ? raw : previousSubjects;
      const seen = new Set();
      const cleaned = [];
      for (const s of use) {
        if (!s || !s.slug) continue;
        if (seen.has(s.slug)) continue;
        seen.add(s.slug);
        cleaned.push({ name: s.name, slug: s.slug });
      }
      normalizedClasses.push({ grade, subjects: cleaned });
      if (cleaned.length > 0) previousSubjects = cleaned;
    }

    for (const classSeed of normalizedClasses) {
      console.log(`➡️  [STEP] Upserting class: Grade ${classSeed.grade} for board: ${board.name}`);
      const classLevel = await prisma.classLevel.upsert({
        where: { boardId_grade: { boardId: board.id, grade: classSeed.grade } },
        update: {},
        create: { boardId: board.id, grade: classSeed.grade, slug: `class-${classSeed.grade}` },
      });
      console.log(`✅ [CLASS] Class upserted: Grade ${classSeed.grade} (slug: class-${classSeed.grade}) for board: ${board.name}`);

      const subjectsToSeed = classSeed.subjects;
      console.log(`➡️  [STEP] Seeding ${subjectsToSeed.length} subjects for Grade ${classSeed.grade} (${board.name})`);

      for (const subject of subjectsToSeed) {
        console.log(`   • [SUBJECT] Upserting subject: "${subject.name}" (slug: ${subject.slug}) for Grade ${classSeed.grade} (${board.name})`);
        await prisma.subjectDef.upsert({
          where: { classId_slug: { classId: classLevel.id, slug: subject.slug } },
          update: {},
          create: { classId: classLevel.id, name: subject.name, slug: subject.slug },
        });
      }
      if (subjectsToSeed.length === 0) {
        console.log(`   • [INFO] No new subjects for Grade ${classSeed.grade} (${board.name}), inheriting from previous grade`);
      }
    }

    console.log(`\n✅ [DONE] Finished processing board: ${board.name}\n`);
  }

  console.log('🎉 [COMPLETE] Academic base seeding completed successfully');
}

main()
  .catch((err) => {
    console.error('❌ [ERROR] Seed failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
