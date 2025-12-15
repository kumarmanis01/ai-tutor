/**
 * SEED SCRIPT GUARDRails:
 * - Script MUST be idempotent
 * - Never use create() without checking existence
 * - Always use upsert with compound unique keys
 * - Seed scripts must be safe to rerun after crashes
 * - Never overwrite existing academic data
 * - Uses unique constraints, not IDs
 * - Never overwrites approved / edited content
 * - Safe after crashes / partial runs
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const BOARDS = ["CBSE", "ICSE", "IB"];
const SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "Hindi",
  "Sanskrit",
  "Computer",
  "EVS",
  "Art",
  "Physical Education",
  "Music",
  "General Knowledge",
];

async function main() {
  for (const boardName of BOARDS) {
      console.log(`\n=== Processing Board: ${boardName} ===`);
    const board = await prisma.board.upsert({
      where: { slug: boardName.toLowerCase() },
      update: {},
      create: {
        name: boardName,
        slug: boardName.toLowerCase(),
      },
    });

    for (let grade = 1; grade <= 12; grade++) {
        console.log(`  -- Class: ${grade}`);
      const cls = await prisma.classLevel.upsert({
        where: {
          boardId_grade: {
            boardId: board.id,
            grade,
          },
        },
        update: {},
        create: {
          grade,
          slug: `class-${grade}`,
          boardId: board.id,
        },
      });

      for (const subjectName of SUBJECTS) {
          console.log(`    >> Subject: ${subjectName}`);
        await prisma.subjectDef.upsert({
          where: {
            classId_slug: {
              classId: cls.id,
              slug: subjectName.toLowerCase().replace(/\s+/g, "-"),
            },
          },
          update: {},
          create: {
            name: subjectName,
            slug: subjectName.toLowerCase().replace(/\s+/g, "-"),
            classId: cls.id,
          },
        });

        // for (let c = 1; c <= 5; c++) {
        //     console.log(`      :: Chapter: ${subjectName} Chapter ${c}`);
        //   const chapterSlug = `chapter-${c}`;

        //   const chapter = await prisma.chapterDef.upsert({
        //     where: {
        //       subjectId_slug_version: {
        //         subjectId: subject.id,
        //         slug: chapterSlug,
        //         version: 1,
        //       },
        //     },
        //     update: {},
        //     create: {
        //       name: `${subjectName} Chapter ${c}`,
        //       slug: chapterSlug,
        //       order: c,
        //       subjectId: subject.id,
        //     },
        //   });

          // for (let t = 1; t <= 4; t++) {
          //     console.log(`        .. Topic: Topic ${t}`);
          //   const topicSlug = `topic-${t}`;

          //   await prisma.topicDef.upsert({
          //     where: {
          //       chapterId_slug: {
          //         chapterId: chapter.id,
          //         slug: topicSlug,
          //       },
          //     },
          //     update: {},
          //     create: {
          //       name: `Topic ${t}`,
          //       slug: topicSlug,
          //       order: t,
          //       chapterId: chapter.id,
          //     },
          //   });
          // }
      }
    }
  }
}

main()
  .then(() => console.log("✅ Academic seed completed safely"))
  .catch((e) => {
    console.error("❌ Seed failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
