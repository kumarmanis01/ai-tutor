/**
 * Simulate HydrateAll Pipeline
 *
 * Processes pending HydrationJobs without Redis or LLM calls.
 * Creates mock chapters, topics, notes, and questions, then
 * runs the reconciler to cascade through all 4 levels.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs","resolveJsonModule":true}' \
 *     -r tsconfig-paths/register scripts/simulate-hydration.ts
 */

import { prisma } from '../lib/prisma';
import { HydrationReconciler } from '../worker/services/hydrationReconciler';
import { toSlug } from '../lib/slug';

const reconciler = new HydrationReconciler();

// Simulated syllabus data
const MOCK_CHAPTERS = [
  {
    title: 'Number Systems',
    topics: ['Real Numbers', 'Irrational Numbers', 'Decimal Expansions'],
  },
  {
    title: 'Polynomials',
    topics: ['Degree of a Polynomial', 'Zeroes of a Polynomial', 'Factorisation'],
  },
  {
    title: 'Coordinate Geometry',
    topics: ['Cartesian Plane', 'Plotting Points', 'Linear Equations on a Graph'],
  },
];

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  // eslint-disable-next-line no-console
  console.log(`[${ts}] ${msg}`);
}

async function findPendingRootJob() {
  return prisma.hydrationJob.findFirst({
    where: {
      rootJobId: null,
      status: 'pending',
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function simulateSyllabusGeneration(jobId: string, subjectId: string) {
  log('--- LEVEL 1: Simulating syllabus generation (chapters + topics) ---');

  // Claim job
  await prisma.hydrationJob.update({
    where: { id: jobId },
    data: { status: 'running', attempts: { increment: 1 }, lockedAt: new Date() },
  });

  let totalChapters = 0;
  let totalTopics = 0;

  for (let i = 0; i < MOCK_CHAPTERS.length; i++) {
    const ch = MOCK_CHAPTERS[i];
    const chSlug = toSlug(ch.title);

    // Check if chapter already exists (idempotent)
    const existing = await prisma.chapterDef.findFirst({
      where: { subjectId, slug: chSlug },
    });

    if (existing) {
      log(`  Chapter "${ch.title}" already exists, skipping`);
      totalChapters++;
      continue;
    }

    const chapter = await prisma.chapterDef.create({
      data: {
        name: ch.title,
        slug: chSlug,
        order: i + 1,
        subjectId,
        status: 'draft',
        lifecycle: 'active',
      },
    });

    log(`  Created chapter: ${ch.title} (${chapter.id})`);
    totalChapters++;

    // Create topics for this chapter
    for (let j = 0; j < ch.topics.length; j++) {
      const topicTitle = ch.topics[j];
      const tSlug = toSlug(topicTitle);

      await prisma.topicDef.create({
        data: {
          name: topicTitle,
          slug: tSlug,
          order: j + 1,
          chapterId: chapter.id,
          status: 'approved',
          lifecycle: 'active',
        },
      });
      totalTopics++;
    }
    log(`    Created ${ch.topics.length} topics for "${ch.title}"`);
  }

  // Mark job completed
  await prisma.hydrationJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      chaptersCompleted: totalChapters,
      topicsCompleted: totalTopics,
      contentReady: true,
    },
  });

  log(`  Syllabus complete: ${totalChapters} chapters, ${totalTopics} topics`);
}

async function simulateLevel2Jobs(rootJobId: string) {
  log('--- LEVEL 2: Simulating topic expansion (marking jobs completed) ---');

  const level2Jobs = await prisma.hydrationJob.findMany({
    where: { rootJobId, hierarchyLevel: 2, status: 'pending' },
  });

  for (const job of level2Jobs) {
    await prisma.hydrationJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    log(`  Completed Level 2 job: ${job.id} (chapter: ${job.chapterId})`);
  }
}

async function simulateLevel3Jobs(rootJobId: string, _subjectId: string) {
  log('--- LEVEL 3: Simulating note generation ---');

  const level3Jobs = await prisma.hydrationJob.findMany({
    where: { rootJobId, hierarchyLevel: 3, status: 'pending' },
  });

  for (const job of level3Jobs) {
    const topicId = job.topicId;
    if (topicId) {
      const topic = await prisma.topicDef.findUnique({ where: { id: topicId } });
      if (topic) {
        // Check if note already exists
        const existingNote = await prisma.topicNote.findFirst({
          where: { topicId, language: job.language },
        });

        if (!existingNote) {
          await prisma.topicNote.create({
            data: {
              topicId,
              language: job.language,
              version: 1,
              status: 'draft',
              title: `Notes: ${topic.name}`,
              contentJson: {
                sections: [
                  {
                    heading: 'Introduction',
                    content: `This topic covers ${topic.name}. Key concepts include definitions, properties, and real-world applications.`,
                  },
                  {
                    heading: 'Key Concepts',
                    content: `Understanding ${topic.name} is essential for building a strong foundation in this subject.`,
                  },
                ],
              },
              source: 'ai-generated',
            },
          });
          log(`  Generated note for "${topic.name}"`);
        }
      }
    }

    await prisma.hydrationJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });
  }

  log(`  Completed ${level3Jobs.length} Level 3 jobs (notes)`);
}

async function simulateLevel4Jobs(rootJobId: string) {
  log('--- LEVEL 4: Simulating question generation ---');

  const level4Jobs = await prisma.hydrationJob.findMany({
    where: { rootJobId, hierarchyLevel: 4, status: 'pending' },
  });

  for (const job of level4Jobs) {
    const topicId = job.topicId;
    if (topicId) {
      const topic = await prisma.topicDef.findUnique({ where: { id: topicId } });
      if (topic) {
        const difficulty = job.difficulty || 'medium';

        // Check if test already exists
        const existingTest = await prisma.generatedTest.findFirst({
          where: { topicId, difficulty, language: job.language },
        });

        if (!existingTest) {
          const test = await prisma.generatedTest.create({
            data: {
              topicId,
              title: `${topic.name} - ${difficulty} Quiz`,
              difficulty,
              language: job.language,
              version: 1,
              status: 'draft',
            },
          });

          // Create 3 MCQ questions per test
          for (let q = 1; q <= 3; q++) {
            await prisma.generatedQuestion.create({
              data: {
                testId: test.id,
                type: 'MCQ',
                question: `[${difficulty}] Question ${q} about ${topic.name}?`,
                options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
                answer: { correct: 'A', explanation: `This tests understanding of ${topic.name}.` },
                marks: difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1,
              },
            });
          }
          log(`  Generated ${difficulty} quiz for "${topic.name}" (3 questions)`);
        }
      }
    }

    await prisma.hydrationJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });
  }

  log(`  Completed ${level4Jobs.length} Level 4 jobs (questions)`);
}

async function main() {
  log('=== HydrateAll Pipeline Simulation ===\n');

  // Step 1: Find pending root job
  const rootJob = await findPendingRootJob();
  if (!rootJob) {
    log('No pending root HydrationJob found.');
    log('Submit a job from the admin UI at /admin/content-engine/hydrateAll first.');
    await prisma.$disconnect();
    return;
  }

  log(`Found root job: ${rootJob.id}`);
  log(`  Subject: ${rootJob.subject} | Board: ${rootJob.board} | Grade: ${rootJob.grade}`);
  log(`  Language: ${rootJob.language} | Difficulty: ${rootJob.difficulty}\n`);

  const subjectId = rootJob.subjectId;
  if (!subjectId) {
    log('ERROR: Root job has no subjectId. Cannot proceed.');
    await prisma.$disconnect();
    return;
  }

  // Step 2: Simulate Level 1 (syllabus)
  await simulateSyllabusGeneration(rootJob.id, subjectId);

  // Step 3: Create Level 1 child jobs so reconciler can detect completion
  // The root job IS Level 0. We need a Level 1 job marked as completed.
  const existingL1 = await prisma.hydrationJob.count({
    where: { rootJobId: rootJob.id, hierarchyLevel: 1 },
  });
  if (existingL1 === 0) {
    await prisma.hydrationJob.create({
      data: {
        jobType: 'syllabus',
        subjectId,
        language: rootJob.language,
        difficulty: rootJob.difficulty,
        status: 'completed',
        hierarchyLevel: 1,
        rootJobId: rootJob.id,
        parentJobId: rootJob.id,
        completedAt: new Date(),
      },
    });
    log('  Created Level 1 sentinel job (completed)\n');
  }

  // Step 4: Run reconciler → creates Level 2 jobs
  log('Running reconciler (Level 1 → Level 2)...');
  await reconciler.reconcile();

  const l2Count = await prisma.hydrationJob.count({
    where: { rootJobId: rootJob.id, hierarchyLevel: 2 },
  });
  log(`  Reconciler created ${l2Count} Level 2 jobs\n`);

  // Step 5: Simulate Level 2
  if (l2Count > 0) {
    await simulateLevel2Jobs(rootJob.id);

    // Step 6: Run reconciler → creates Level 3 jobs
    log('\nRunning reconciler (Level 2 → Level 3)...');
    await reconciler.reconcile();

    const l3Count = await prisma.hydrationJob.count({
      where: { rootJobId: rootJob.id, hierarchyLevel: 3 },
    });
    log(`  Reconciler created ${l3Count} Level 3 jobs\n`);

    // Step 7: Simulate Level 3 (notes)
    if (l3Count > 0) {
      await simulateLevel3Jobs(rootJob.id, subjectId);

      // Step 8: Run reconciler → creates Level 4 jobs
      log('\nRunning reconciler (Level 3 → Level 4)...');
      await reconciler.reconcile();

      const l4Count = await prisma.hydrationJob.count({
        where: { rootJobId: rootJob.id, hierarchyLevel: 4 },
      });
      log(`  Reconciler created ${l4Count} Level 4 jobs\n`);

      // Step 9: Simulate Level 4 (questions)
      if (l4Count > 0) {
        await simulateLevel4Jobs(rootJob.id);

        // Step 10: Final reconciliation
        log('\nRunning final reconciler...');
        await reconciler.reconcile();
      }
    }
  }

  // Step 11: Show final state
  log('\n=== Final Job State ===');
  const finalJob = await prisma.hydrationJob.findUnique({ where: { id: rootJob.id } });
  if (finalJob) {
    log(`  Status: ${finalJob.status}`);
    log(`  Chapters: ${finalJob.chaptersCompleted}/${finalJob.chaptersExpected}`);
    log(`  Topics: ${finalJob.topicsCompleted}/${finalJob.topicsExpected}`);
    log(`  Notes: ${finalJob.notesCompleted}/${finalJob.notesExpected}`);
    log(`  Questions: ${finalJob.questionsCompleted}/${finalJob.questionsExpected}`);
  }

  // Content summary
  const chapters = await prisma.chapterDef.count({ where: { subjectId, lifecycle: 'active' } });
  const topics = await prisma.topicDef.count({
    where: { chapter: { subjectId }, lifecycle: 'active' },
  });
  const notes = await prisma.topicNote.count({
    where: { topic: { chapter: { subjectId } }, status: 'approved' },
  });
  const questions = await prisma.generatedQuestion.count({
    where: { test: { topic: { chapter: { subjectId } } } },
  });

  log(`\n=== Content Created ===`);
  log(`  Chapters: ${chapters}`);
  log(`  Topics:   ${topics}`);
  log(`  Notes:    ${notes}`);
  log(`  Questions: ${questions}`);
  log('\nDone. Refresh the admin UI to see updated progress.');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('Simulation failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
