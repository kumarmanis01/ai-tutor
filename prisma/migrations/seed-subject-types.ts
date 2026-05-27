/**
 * Seed SubjectType and targetLanguage for existing SubjectDef rows.
 * Run once after applying the 20260527000001_add_subject_type_language migration.
 *
 * Usage: DATABASE_URL="..." npx tsx prisma/migrations/seed-subject-types.ts
 *    or: npx tsx prisma/migrations/seed-subject-types.ts  (if DATABASE_URL already in env)
 */

import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const LANGUAGE_SUBJECTS: Record<string, string> = {
  Hindi: 'hi',
  English: 'en',
  Sanskrit: 'sa',
  French: 'fr',
  German: 'de',
  Spanish: 'es',
  Urdu: 'ur',
  Tamil: 'ta',
  Telugu: 'te',
  Kannada: 'kn',
  Malayalam: 'ml',
  Bengali: 'bn',
  Marathi: 'mr',
  Gujarati: 'gu',
  Punjabi: 'pa',
  Odia: 'or',
  Assamese: 'as',
  Maithili: 'mai',
  Sindhi: 'sd',
  Konkani: 'kok',
  Arabic: 'ar',
  Japanese: 'ja',
  Chinese: 'zh',
  Russian: 'ru',
};

const STEM_SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Accountancy',
  'Statistics',
  'Environmental Science',
];

const SOCIAL_SUBJECTS = [
  'History',
  'Geography',
  'Civics',
  'Political Science',
  'Economics',
  'Sociology',
  'Psychology',
  'EVS',
  'Social Science',
];

async function main() {
  let updated = 0;

  for (const [name, code] of Object.entries(LANGUAGE_SUBJECTS)) {
    const result = await prisma.subjectDef.updateMany({
      where: { name: { equals: name, mode: 'insensitive' } },
      data: { subjectType: 'LANGUAGE', targetLanguage: code },
    });
    updated += result.count;
  }

  for (const name of STEM_SUBJECTS) {
    const result = await prisma.subjectDef.updateMany({
      where: { name: { equals: name, mode: 'insensitive' } },
      data: { subjectType: 'STEM' },
    });
    updated += result.count;
  }

  for (const name of SOCIAL_SUBJECTS) {
    const result = await prisma.subjectDef.updateMany({
      where: { name: { equals: name, mode: 'insensitive' } },
      data: { subjectType: 'SOCIAL' },
    });
    updated += result.count;
  }

  console.log(`Seed complete. Updated ${updated} subject rows.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
