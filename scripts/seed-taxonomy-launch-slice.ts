/**
 * Taxonomy & Content Readiness -- Launch slice (PreLaunch Gap Analysis Task 1).
 * Seeds:
 * - BoardSubjectConfig for CBSE + ICSE Grade 6-12 (isCore for mandatory subjects).
 * - BoardChapterWeight for CBSE Grade 10 Maths + Science chapters.
 * - Concept records from existing TopicDef for CBSE Grade 10 Maths + Science
 *   with description, irt_b, bloomLevel, prerequisiteConceptIds, commonlyConfusedWithIds.
 *
 * Run after: seed-taxonomy.cjs (Board/ClassLevel/SubjectDef must exist).
 * Idempotent: safe to rerun.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Core subjects per board+grade (mandatory for exam). Others are optional. */
const CORE_SUBJECT_SLUGS = new Set([
  "english",
  "mathematics",
  "science",
  "physics",
  "chemistry",
  "biology",
  "social-science",
  "history",
  "geography",
  "economics",
  "history-civics-geography",
]);

async function seedBoardSubjectConfig() {
  const boards = await prisma.board.findMany({
    where: { slug: { in: ["cbse", "icse"] }, lifecycle: "active" },
    include: { classes: { include: { subjects: true } } },
  });

  for (const board of boards) {
    for (const cls of board.classes) {
      if (cls.grade < 6 || cls.grade > 12) continue;
      for (const subj of cls.subjects) {
        const isCore = CORE_SUBJECT_SLUGS.has(subj.slug);
        await prisma.boardSubjectConfig.upsert({
          where: { subjectDefId: subj.id },
          update: { isCore },
          create: {
            subjectDefId: subj.id,
            isCore,
          },
        });
      }
    }
  }
  console.log("✅ BoardSubjectConfig seeded for CBSE + ICSE Grade 6-12");
}

/** Placeholder marks per chapter (CBSE Grade 10 style). Replace with official marking scheme. */
const DEFAULT_CHAPTER_WEIGHT = 8;

async function seedBoardChapterWeights() {
  const cbse = await prisma.board.findFirst({ where: { slug: "cbse" } });
  if (!cbse) {
    console.log("⚠️ Board CBSE not found; run seed-taxonomy.cjs first.");
    return;
  }
  const class10 = await prisma.classLevel.findFirst({
    where: { boardId: cbse.id, grade: 10 },
    include: {
      subjects: {
        where: {
          slug: { in: ["mathematics", "physics", "chemistry", "biology", "science"] },
        },
        include: { chapters: true },
      },
    },
  });
  if (!class10) {
    console.log("⚠️ CBSE Grade 10 class not found.");
    return;
  }
  for (const subj of class10.subjects) {
    for (const ch of subj.chapters) {
      await prisma.boardChapterWeight.upsert({
        where: { chapterId: ch.id },
        update: { weightMarks: DEFAULT_CHAPTER_WEIGHT },
        create: {
          chapterId: ch.id,
          weightMarks: DEFAULT_CHAPTER_WEIGHT,
        },
      });
    }
  }
  console.log("✅ BoardChapterWeight seeded for CBSE Grade 10 Maths + Science chapters");
}

/** One Concept per Topic for launch slice; backfill description, irt_b, bloomLevel, etc. */
async function seedConceptsFromTopics() {
  const cbse = await prisma.board.findFirst({ where: { slug: "cbse" } });
  if (!cbse) return;
  const class10 = await prisma.classLevel.findFirst({
    where: { boardId: cbse.id, grade: 10 },
    include: {
      subjects: {
        where: {
          slug: { in: ["mathematics", "physics", "chemistry", "biology", "science"] },
        },
        include: {
          chapters: {
            include: { topics: true },
          },
        },
      },
    },
  });
  if (!class10) return;

  let created = 0;
  let updated = 0;
  for (const subj of class10.subjects) {
    for (const ch of subj.chapters) {
      for (const topic of ch.topics) {
        const existing = await prisma.concept.findFirst({
          where: { topicId: topic.id },
        });
        const payload = {
          topicId: topic.id,
          subjectId: subj.id,
          name: topic.name,
          description: topic.name, // Minimal; replace with real descriptions for production
          irt_b: 0,
          bloomLevel: "understand",
          prerequisiteConceptIds: [],
          commonlyConfusedWithIds: [],
        };
        if (existing) {
          await prisma.concept.update({
            where: { id: existing.id },
            data: {
              description: payload.description,
              irt_b: payload.irt_b,
              bloomLevel: payload.bloomLevel,
              prerequisiteConceptIds: payload.prerequisiteConceptIds,
              commonlyConfusedWithIds: payload.commonlyConfusedWithIds,
            },
          });
          updated++;
        } else {
          await prisma.concept.create({ data: payload });
          created++;
        }
      }
    }
  }
  console.log(`✅ Concepts: ${created} created, ${updated} updated for CBSE Grade 10 Maths + Science`);
}

/** Set irt_b on questions in launch slice (topic in CBSE 10 Maths/Science) where null. Default 0; replace with real values per question. */
async function backfillQuestionIrtB() {
  const cbse = await prisma.board.findFirst({ where: { slug: "cbse" } });
  if (!cbse) return;
  const class10 = await prisma.classLevel.findFirst({
    where: { boardId: cbse.id, grade: 10 },
    include: {
      subjects: {
        where: {
          slug: { in: ["mathematics", "physics", "chemistry", "biology", "science"] },
        },
        include: { chapters: { include: { topics: { select: { id: true } } } } },
      },
    },
  });
  if (!class10) return;
  const topicIds = class10.subjects.flatMap((s) =>
    s.chapters.flatMap((c) => c.topics.map((t) => t.id))
  );
  const result = await prisma.question.updateMany({
    where: { topicId: { in: topicIds }, irt_b: null },
    data: { irt_b: 0 },
  });
  if (result.count > 0) {
    console.log(`✅ Question.irt_b backfilled for ${result.count} questions (default 0; set per-question manually if needed).`);
  }
}

async function main() {
  console.log("🌱 [START] Taxonomy & content readiness (launch slice)...\n");
  await seedBoardSubjectConfig();
  await seedBoardChapterWeights();
  await seedConceptsFromTopics();
  await backfillQuestionIrtB();
  console.log("\n🎉 [DONE] Taxonomy launch slice seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
