/**
 * COPILOT:
 * This seed script defines ONLY academic taxonomy.
 * Do NOT add chapters, topics, notes, AI calls, or workers here.
 * This file is deterministic and must remain idempotent.
 */

/**
 * SEED SCRIPT GUARDRAILS:
 * - Script MUST be idempotent
 * - Never use create() without checking existence
 * - Always use upsert with compound unique keys
 * - Seed scripts must be safe to rerun after crashes
 * - Never overwrite existing academic data
 * - Uses unique constraints, not IDs
 * - Never overwrites approved / edited content
 * - Safe after crashes / partial runs
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type SubjectSeed = {
  name: string
  slug: string
}

type ClassSeed = {
  grade: number
  subjects: SubjectSeed[]
}

type BoardSeed = {
  name: string
  slug: string
  classes: ClassSeed[]
}

const BOARDS: BoardSeed[] = [
  {
    name: "CBSE",
    slug: "cbse",
    classes: [
      {
        grade: 1,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Hindi", slug: "hindi" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Environmental Studies", slug: "evs" },
          { name: "Art Education", slug: "art-education" },
          { name: "Health & Physical Education", slug: "physical-education" },
          { name: "Computer Science", slug: "computer-science" },
        ],
      },
      { grade: 2, subjects: [] },
      {
        grade: 3,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Hindi", slug: "hindi" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Environmental Studies", slug: "evs" },
          { name: "General Knowledge", slug: "general-knowledge" },
          { name: "Art Education", slug: "art-education" },
          { name: "Health & Physical Education", slug: "physical-education" },
          { name: "Computer Science", slug: "computer-science" },
        ],
      },
      { grade: 4, subjects: [] },
      { grade: 5, subjects: [] },
      {
        grade: 6,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Hindi", slug: "hindi" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Science", slug: "science" },
          { name: "Social Science", slug: "social-science" },
          { name: "Computer Science", slug: "computer-science" },
        ],
      },
      { grade: 7, subjects: [] },
      { grade: 8, subjects: [] },
      {
        grade: 9,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Physics", slug: "physics" },
          { name: "Chemistry", slug: "chemistry" },
          { name: "Biology", slug: "biology" },
          { name: "History", slug: "history" },
          { name: "Geography", slug: "geography" },
          { name: "Economics", slug: "economics" },
          { name: "Computer Applications", slug: "computer-applications" },
        ],
      },
      { grade: 10, subjects: [] },
      {
        grade: 11,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Physics", slug: "physics" },
          { name: "Chemistry", slug: "chemistry" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Biology", slug: "biology" },
          { name: "Accountancy", slug: "accountancy" },
          { name: "Business Studies", slug: "business-studies" },
          { name: "Economics", slug: "economics" },
          { name: "History", slug: "history" },
          { name: "Political Science", slug: "political-science" },
        ],
      },
      { grade: 12, subjects: [] },
    ],
  },
  {
    name: "ICSE",
    slug: "icse",
    classes: [
      {
        grade: 1,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Second Language", slug: "second-language" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Environmental Studies", slug: "evs" },
          { name: "Computer Applications", slug: "computer-applications" },
          { name: "Art & Music", slug: "art-music" },
          { name: "Physical Education", slug: "physical-education" },
        ],
      },
      { grade: 2, subjects: [] },
      { grade: 3, subjects: [] },
      { grade: 4, subjects: [] },
      { grade: 5, subjects: [] },
      {
        grade: 9,
        subjects: [
          { name: "English", slug: "english" },
          { name: "Mathematics", slug: "mathematics" },
          { name: "Physics", slug: "physics" },
          { name: "Chemistry", slug: "chemistry" },
          { name: "Biology", slug: "biology" },
          { name: "History Civics & Geography", slug: "history-civics-geography" },
          { name: "Computer Applications", slug: "computer-applications" },
        ],
      },
      { grade: 10, subjects: [] },
    ],
  },
]

async function main() {
  console.log("🌱 [START] Academic base seeding initiated...\n")

  for (const boardSeed of BOARDS) {
    console.log(`➡️  [STEP] Processing board: ${boardSeed.name} (${boardSeed.slug})`)
    const board = await prisma.board.upsert({
      where: { slug: boardSeed.slug },
      update: {},
      create: {
        name: boardSeed.name,
        slug: boardSeed.slug,
      },
    })
    console.log(`✅ [BOARD] Board upserted: ${board.name} (slug: ${board.slug})`)

    // Normalize classes for this board: ensure grades 1..12, inherit subjects when
    // a grade has an empty array, dedupe subject slugs, and ignore duplicate grade entries.
    console.log(`🔄 [STEP] Normalizing classes for board: ${board.name}`)
    const classMap = new Map<number, SubjectSeed[]>();
    for (const cs of boardSeed.classes) {
      if (!cs || typeof cs.grade !== 'number') continue;
      // If multiple entries for same grade exist, prefer the first occurrence
      if (!classMap.has(cs.grade)) classMap.set(cs.grade, cs.subjects || []);
    }

    const normalizedClasses: ClassSeed[] = [];
    let previousSubjects: SubjectSeed[] = [];
    for (let grade = 1; grade <= 12; grade++) {
      const raw = classMap.get(grade) || [];
      const use = raw.length > 0 ? raw : previousSubjects;
      // dedupe by slug while preserving order
      const seen = new Set<string>();
      const cleaned: SubjectSeed[] = [];
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
      console.log(
        `➡️  [STEP] Upserting class: Grade ${classSeed.grade} for board: ${board.name}`
      );
      const classLevel = await prisma.classLevel.upsert({
        where: {
          boardId_grade: {
            boardId: board.id,
            grade: classSeed.grade,
          },
        },
        update: {},
        create: {
          boardId: board.id,
          grade: classSeed.grade,
          slug: `class-${classSeed.grade}`,
        },
      });
      console.log(
        `✅ [CLASS] Class upserted: Grade ${classSeed.grade} (slug: class-${classSeed.grade}) for board: ${board.name}`
      );

      const subjectsToSeed = classSeed.subjects;
      console.log(
        `➡️  [STEP] Seeding ${subjectsToSeed.length} subjects for Grade ${classSeed.grade} (${board.name})`
      );

      for (const subject of subjectsToSeed) {
        console.log(
          `   • [SUBJECT] Upserting subject: "${subject.name}" (slug: ${subject.slug}) for Grade ${classSeed.grade} (${board.name})`
        );
        await prisma.subjectDef.upsert({
          where: {
            classId_slug: {
              classId: classLevel.id,
              slug: subject.slug,
            },
          },
          update: {},
          create: {
            classId: classLevel.id,
            name: subject.name,
            slug: subject.slug,
          },
        });
      }
      if (subjectsToSeed.length === 0) {
        console.log(
          `   • [INFO] No new subjects for Grade ${classSeed.grade} (${board.name}), inheriting from previous grade`
        );
      }
    }

    console.log(`\n✅ [DONE] Finished processing board: ${board.name}\n`);
  }

  console.log("🎉 [COMPLETE] Academic base seeding completed successfully");
}

main()
  .catch((err) => {
    console.error("❌ [ERROR] Seed failed", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
