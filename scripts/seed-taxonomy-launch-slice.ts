/**
 * Taxonomy & Content Readiness -- Full-coverage seed (all active boards, grades 1-12).
 * Seeds:
 * - BoardSubjectConfig for CBSE + ICSE all active grades (isCore for mandatory subjects).
 * - BoardChapterWeight for all active boards/grades/subjects (placeholder 8 marks per chapter).
 * - Concept records from existing TopicDef for all active boards/grades/subjects.
 * - Question.irt_b backfill (default 0) for all active boards/grades.
 *
 * Run after: seed-taxonomy.cjs (Board/ClassLevel/SubjectDef must exist).
 * Idempotent: safe to rerun.
 */
import { prisma } from '../lib/prisma';

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

  let seeded = 0;
  for (const board of boards) {
    for (const cls of board.classes) {
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
        seeded++;
      }
    }
  }
  console.log(`BoardSubjectConfig seeded for ${seeded} subjects across all active CBSE + ICSE grades`);
}

/** Placeholder marks per chapter. Replace with official marking scheme per grade/subject. */
const DEFAULT_CHAPTER_WEIGHT = 8;

async function seedBoardChapterWeights() {
  const boards = await prisma.board.findMany({
    where: { slug: { in: ["cbse", "icse"] }, lifecycle: "active" },
    include: {
      classes: {
        where: { lifecycle: "active" },
        include: {
          subjects: {
            where: { lifecycle: "active", isAvailable: true },
            include: { chapters: { where: { lifecycle: "active" } } },
          },
        },
      },
    },
  });

  let seeded = 0;
  for (const board of boards) {
    for (const cls of board.classes) {
      for (const subj of cls.subjects) {
        for (const ch of subj.chapters) {
          await prisma.boardChapterWeight.upsert({
            where: { chapterId: ch.id },
            update: { weightMarks: DEFAULT_CHAPTER_WEIGHT },
            create: {
              chapterId: ch.id,
              weightMarks: DEFAULT_CHAPTER_WEIGHT,
            },
          });
          seeded++;
        }
      }
    }
  }
  console.log(`BoardChapterWeight seeded for ${seeded} chapters across all active boards/grades`);
}

/** One Concept per Topic for all active boards/grades/subjects; idempotent. */
async function seedConceptsFromTopics() {
  const boards = await prisma.board.findMany({
    where: { slug: { in: ["cbse", "icse"] }, lifecycle: "active" },
    include: {
      classes: {
        where: { lifecycle: "active" },
        include: {
          subjects: {
            where: { lifecycle: "active", isAvailable: true },
            include: {
              chapters: {
                where: { lifecycle: "active" },
                include: { topics: { where: { lifecycle: "active" } } },
              },
            },
          },
        },
      },
    },
  });

  let created = 0;
  let updated = 0;
  for (const board of boards) {
    for (const cls of board.classes) {
      for (const subj of cls.subjects) {
        for (const ch of subj.chapters) {
          for (const topic of ch.topics) {
            const existing = await prisma.concept.findFirst({
              where: { topicId: topic.id },
            });
            const payload = {
              topicId: topic.id,
              subjectId: subj.id,
              name: topic.name,
              description: topic.name, // Minimal placeholder; replace with real descriptions for production
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
    }
  }
  console.log(`Concepts: ${created} created, ${updated} updated for all active boards/grades`);
}

/** Set irt_b=0 on questions where null, for all active boards/grades. */
async function backfillQuestionIrtB() {
  const boards = await prisma.board.findMany({
    where: { slug: { in: ["cbse", "icse"] }, lifecycle: "active" },
    include: {
      classes: {
        where: { lifecycle: "active" },
        include: {
          subjects: {
            where: { lifecycle: "active", isAvailable: true },
            include: {
              chapters: {
                where: { lifecycle: "active" },
                include: { topics: { select: { id: true }, where: { lifecycle: "active" } } },
              },
            },
          },
        },
      },
    },
  });

  const topicIds = boards.flatMap((b) =>
    b.classes.flatMap((c) =>
      c.subjects.flatMap((s) =>
        s.chapters.flatMap((ch) => ch.topics.map((t) => t.id))
      )
    )
  );

  if (!topicIds.length) return;

  const result = await prisma.question.updateMany({
    where: { topicId: { in: topicIds }, irt_b: null },
    data: { irt_b: 0 },
  });
  if (result.count > 0) {
    console.log(`Question.irt_b backfilled for ${result.count} questions across all active boards/grades`);
  }
}

async function main() {
  console.log("🌱 [START] Taxonomy & content readiness seed (all grades 1-12)...\n");
  await seedBoardSubjectConfig();
  await seedBoardChapterWeights();
  await seedConceptsFromTopics();
  await backfillQuestionIrtB();
  console.log("\n🎉 [DONE] Taxonomy seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
