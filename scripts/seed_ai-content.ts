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
 * - For Classes above 3 - 7, EVS will change to Science
 * - For Classes above 7 - 10, add Social Studies, remove EVS
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Subject lists per board and grade
const SUBJECTS_BY_BOARD: Record<string, Record<number, string[]>> = {
  CBSE: {},
  ICSE: {},
  IB: {}, // You can fill IB as needed
};

// CBSE subject mapping
for (let grade = 1; grade <= 12; grade++) {
  if (grade <= 5) {
    SUBJECTS_BY_BOARD.CBSE[grade] = [
      "English",
      "Hindi",
      "Mathematics",
      "Environmental Studies",
      "General Knowledge",
      "Art Education",
      "Health & Physical Education",
      "Computer Science",
    ];
  } else if (grade <= 8) {
    SUBJECTS_BY_BOARD.CBSE[grade] = [
      "English",
      "Hindi",
      "Mathematics",
      "Science",
      "Social Science",
      "General Knowledge",
      "Art Education",
      "Health & Physical Education",
      "Computer Science",
    ];
  } else if (grade <= 10) {
    SUBJECTS_BY_BOARD.CBSE[grade] = [
      "English",
      "Hindi",
      "Mathematics",
      "Science",
      "Social Science",
      "Computer Applications",
      "Art Education",
      "Physical Education",
    ];
  } else {
    // Streams for 11-12
    SUBJECTS_BY_BOARD.CBSE[grade] = [
      "English",
      // Science Stream
      "Physics",
      "Chemistry",
      "Mathematics",
      "Biology",
      "Computer Science",
      "Biotechnology",
      "Engineering Drawing",
      // Commerce Stream
      "Accountancy",
      "Business Studies",
      "Economics",
      // Humanities/Other
      "Political Science",
      "History",
      "Geography",
      "Psychology",
      "Sociology",
      "Philosophy",
      "Fine Arts",
      "Music",
      "Physical Education",
      "Home Science",
      "Informatics Practices",
    ];
  }
}

// ICSE subject mapping
for (let grade = 1; grade <= 8; grade++) {
  SUBJECTS_BY_BOARD.ICSE[grade] = [
    "English",
    "Second Language",
    "Mathematics",
    "Environmental Studies",
    "Computer Studies",
    "Arts Education",
  ];
}
for (let grade = 9; grade <= 10; grade++) {
  SUBJECTS_BY_BOARD.ICSE[grade] = [
    // Group I (Compulsory)
    "English",
    "Second Language",
    "History, Civics & Geography",
    // Group II (choose at least one, but we seed all common)
    "Mathematics",
    "Science",
    "Economics",
    "Commercial Studies",
    "Environmental Science",
    "Modern/Classical Language",
    "Computer Applications",
    // Group III (choose remaining, seed common)
    "Art",
    "Performing Arts",
    "Home Science",
    "Fashion Designing",
    "Physical Education",
    "Yoga",
    "Technical Drawing",
  ];
}
for (let grade = 11; grade <= 12; grade++) {
  SUBJECTS_BY_BOARD.ICSE[grade] = [
    // Science Stream
    "English",
    "Physics",
    "Chemistry",
    "Mathematics",
    "Biology",
    "Computer Science",
    "Physical Education",
    // Commerce Stream
    "Accountancy",
    "Economics",
    "Business Studies",
    // Humanities/Arts Stream
    "History",
    "Political Science",
    "Geography",
    "Sociology",
    "Psychology",
    "Sanskrit",
    "Fine Arts",
    "Music",
  ];
}

// IB fallback (generic)
for (let grade = 1; grade <= 12; grade++) {
  SUBJECTS_BY_BOARD.IB[grade] = [
    "English",
    "Mathematics",
    "Science",
    "Social Studies",
    "Second Language",
    "Arts",
    "Physical Education",
    "Computer Science",
  ];
}

const BOARDS = ["CBSE", "ICSE", "IB"];

function getSubjects(board: string, grade: number): string[] {
  return SUBJECTS_BY_BOARD[board]?.[grade] || [];
}

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

      const subjects = getSubjects(boardName, grade);
      for (const subjectName of subjects) {
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
