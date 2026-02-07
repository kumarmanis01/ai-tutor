/**
 * Simulate HydrateAll Pipeline (CommonJS)
 *
 * Processes pending HydrationJobs without Redis or LLM calls.
 * Creates mock chapters, topics, notes, and questions, then
 * runs the reconciler cascade through all 4 levels.
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Simulated syllabus data for CBSE Grade 10 Math
const MOCK_CHAPTERS = [
  {
    title: 'Real Numbers',
    topics: ['Euclid Division Lemma', 'Fundamental Theorem of Arithmetic', 'Irrational Numbers', 'Decimal Expansions of Rationals'],
  },
  {
    title: 'Polynomials',
    topics: ['Zeroes of a Polynomial', 'Relationship Between Zeroes and Coefficients', 'Division Algorithm for Polynomials'],
  },
  {
    title: 'Pair of Linear Equations in Two Variables',
    topics: ['Graphical Method of Solution', 'Algebraic Methods of Solving', 'Cross-Multiplication Method'],
  },
  {
    title: 'Quadratic Equations',
    topics: ['Solution by Factorisation', 'Solution by Completing the Square', 'Nature of Roots'],
  },
  {
    title: 'Arithmetic Progressions',
    topics: ['nth Term of an AP', 'Sum of First n Terms', 'Applications of AP'],
  },
];

function toSlug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log('[' + ts + '] ' + msg);
}

async function main() {
  log('=== HydrateAll Pipeline Simulation ===\n');

  // Find pending root job
  const rootJob = await p.hydrationJob.findFirst({
    where: { rootJobId: null, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });

  if (!rootJob) {
    log('No pending root HydrationJob found.');
    log('Submit a job from the admin UI at /admin/content-engine/hydrateAll first.');
    await p.$disconnect();
    return;
  }

  const subjectId = rootJob.subjectId;
  log('Found root job: ' + rootJob.id);
  log('  Subject: ' + rootJob.subject + ' | Board: ' + rootJob.board + ' | Grade: ' + rootJob.grade);
  log('  Language: ' + rootJob.language + ' | SubjectId: ' + subjectId + '\n');

  if (!subjectId) {
    log('ERROR: Root job has no subjectId.');
    await p.$disconnect();
    return;
  }

  // ========== LEVEL 1: Simulate Syllabus Generation ==========
  log('--- LEVEL 1: Simulating syllabus generation (chapters + topics) ---');

  await p.hydrationJob.update({
    where: { id: rootJob.id },
    data: { status: 'running', attempts: { increment: 1 }, lockedAt: new Date() },
  });

  let totalChapters = 0;
  let totalTopics = 0;

  for (let i = 0; i < MOCK_CHAPTERS.length; i++) {
    const ch = MOCK_CHAPTERS[i];
    const chSlug = toSlug(ch.title);

    const existing = await p.chapterDef.findFirst({ where: { subjectId, slug: chSlug } });
    if (existing) {
      log('  Chapter "' + ch.title + '" already exists, skipping');
      totalChapters++;
      continue;
    }

    const chapter = await p.chapterDef.create({
      data: {
        name: ch.title,
        slug: chSlug,
        order: i + 1,
        subjectId,
        status: 'draft',
        lifecycle: 'active',
      },
    });
    log('  Created chapter: ' + ch.title + ' (' + chapter.id + ')');
    totalChapters++;

    for (let j = 0; j < ch.topics.length; j++) {
      const tSlug = toSlug(ch.topics[j]);
      await p.topicDef.create({
        data: {
          name: ch.topics[j],
          slug: tSlug,
          order: j + 1,
          chapterId: chapter.id,
          status: 'draft',
          lifecycle: 'active',
        },
      });
      totalTopics++;
    }
    log('    Created ' + ch.topics.length + ' topics');
  }

  // Mark root job as completed for Level 1
  await p.hydrationJob.update({
    where: { id: rootJob.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      chaptersCompleted: totalChapters,
      topicsCompleted: totalTopics,
      contentReady: true,
    },
  });
  log('  Syllabus complete: ' + totalChapters + ' chapters, ' + totalTopics + ' topics\n');

  // Create Level 1 sentinel job for reconciler
  const existingL1 = await p.hydrationJob.count({ where: { rootJobId: rootJob.id, hierarchyLevel: 1 } });
  if (existingL1 === 0) {
    await p.hydrationJob.create({
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

  // ========== RECONCILER: Level 1 → Level 2 ==========
  log('--- RECONCILER: Detecting Level 1 complete, creating Level 2 jobs ---');

  const chapters = await p.chapterDef.findMany({
    where: { subjectId, lifecycle: 'active' },
    orderBy: { order: 'asc' },
  });

  for (const chapter of chapters) {
    await p.hydrationJob.create({
      data: {
        jobType: 'notes',
        subjectId,
        chapterId: chapter.id,
        language: rootJob.language,
        difficulty: rootJob.difficulty,
        status: 'pending',
        hierarchyLevel: 2,
        rootJobId: rootJob.id,
        parentJobId: rootJob.id,
      },
    });
  }
  log('  Created ' + chapters.length + ' Level 2 jobs (one per chapter)\n');

  // ========== LEVEL 2: Simulate Topic Expansion (mark complete) ==========
  log('--- LEVEL 2: Simulating topic expansion ---');
  const level2Jobs = await p.hydrationJob.findMany({
    where: { rootJobId: rootJob.id, hierarchyLevel: 2, status: 'pending' },
  });
  for (const job of level2Jobs) {
    await p.hydrationJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });
  }
  log('  Completed ' + level2Jobs.length + ' Level 2 jobs\n');

  // ========== RECONCILER: Level 2 → Level 3 ==========
  log('--- RECONCILER: Detecting Level 2 complete, creating Level 3 jobs ---');

  const topics = await p.topicDef.findMany({
    where: { chapter: { subjectId }, lifecycle: 'active' },
    orderBy: { order: 'asc' },
    include: { chapter: true },
  });

  for (const topic of topics) {
    await p.hydrationJob.create({
      data: {
        jobType: 'notes',
        subjectId,
        chapterId: topic.chapterId,
        topicId: topic.id,
        language: rootJob.language,
        difficulty: rootJob.difficulty,
        status: 'pending',
        hierarchyLevel: 3,
        rootJobId: rootJob.id,
        parentJobId: rootJob.id,
      },
    });
  }
  log('  Created ' + topics.length + ' Level 3 jobs (one per topic)\n');

  // ========== LEVEL 3: Simulate Note Generation ==========
  log('--- LEVEL 3: Simulating note generation ---');

  const level3Jobs = await p.hydrationJob.findMany({
    where: { rootJobId: rootJob.id, hierarchyLevel: 3, status: 'pending' },
  });

  for (const job of level3Jobs) {
    if (job.topicId) {
      const topic = await p.topicDef.findUnique({ where: { id: job.topicId } });
      if (topic) {
        const existing = await p.topicNote.findFirst({ where: { topicId: topic.id, language: job.language } });
        if (!existing) {
          await p.topicNote.create({
            data: {
              topicId: topic.id,
              language: job.language,
              version: 1,
              status: 'draft',
              title: 'Notes: ' + topic.name,
              contentJson: {
                sections: [
                  { heading: 'Introduction', content: 'This topic covers ' + topic.name + '.' },
                  { heading: 'Key Concepts', content: 'Understanding ' + topic.name + ' builds a strong foundation.' },
                  { heading: 'Summary', content: 'Review the key points of ' + topic.name + ' regularly.' },
                ],
              },
              source: 'ai-generated',
            },
          });
          log('  Generated note: ' + topic.name);
        }
      }
    }
    await p.hydrationJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });
  }
  log('  Completed ' + level3Jobs.length + ' Level 3 jobs\n');

  // ========== RECONCILER: Level 3 → Level 4 ==========
  log('--- RECONCILER: Detecting Level 3 complete, creating Level 4 jobs ---');

  const difficulties = ['easy', 'medium', 'hard'];
  for (const topic of topics) {
    for (const diff of difficulties) {
      await p.hydrationJob.create({
        data: {
          jobType: 'questions',
          subjectId,
          chapterId: topic.chapterId,
          topicId: topic.id,
          language: rootJob.language,
          difficulty: diff,
          status: 'pending',
          hierarchyLevel: 4,
          rootJobId: rootJob.id,
          parentJobId: rootJob.id,
        },
      });
    }
  }
  log('  Created ' + (topics.length * 3) + ' Level 4 jobs (' + topics.length + ' topics x 3 difficulties)\n');

  // ========== LEVEL 4: Simulate Question Generation ==========
  log('--- LEVEL 4: Simulating question generation ---');

  const level4Jobs = await p.hydrationJob.findMany({
    where: { rootJobId: rootJob.id, hierarchyLevel: 4, status: 'pending' },
  });

  let questionsCreated = 0;
  for (const job of level4Jobs) {
    if (job.topicId) {
      const topic = await p.topicDef.findUnique({ where: { id: job.topicId } });
      if (topic) {
        const diff = job.difficulty;
        const existingTest = await p.generatedTest.findFirst({
          where: { topicId: topic.id, difficulty: diff, language: job.language },
        });

        if (!existingTest) {
          const test = await p.generatedTest.create({
            data: {
              topicId: topic.id,
              title: topic.name + ' - ' + diff + ' Quiz',
              difficulty: diff,
              language: job.language,
              version: 1,
              status: 'draft',
            },
          });

          const marks = diff === 'hard' ? 3 : diff === 'medium' ? 2 : 1;
          for (let q = 1; q <= 3; q++) {
            await p.generatedQuestion.create({
              data: {
                testId: test.id,
                type: 'MCQ',
                question: '[' + diff + '] Q' + q + ': What is a key concept in ' + topic.name + '?',
                options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
                answer: { correct: 'A', explanation: 'This tests understanding of ' + topic.name + '.' },
                marks,
              },
            });
            questionsCreated++;
          }
        }
      }
    }
    await p.hydrationJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });
  }
  log('  Completed ' + level4Jobs.length + ' Level 4 jobs, created ' + questionsCreated + ' questions\n');

  // ========== FINALIZE ROOT JOB ==========
  log('--- FINALIZING: Updating root job progress ---');

  const finalChapters = await p.chapterDef.count({ where: { subjectId, lifecycle: 'active' } });
  const finalTopics = await p.topicDef.count({ where: { chapter: { subjectId }, lifecycle: 'active' } });
  const finalNotes = await p.topicNote.count({ where: { topic: { chapter: { subjectId } } } });
  const finalQuestions = await p.generatedQuestion.count({ where: { test: { topic: { chapter: { subjectId } } } } });

  await p.hydrationJob.update({
    where: { id: rootJob.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      chaptersCompleted: finalChapters,
      chaptersExpected: finalChapters,
      topicsCompleted: finalTopics,
      topicsExpected: finalTopics,
      notesCompleted: finalNotes,
      notesExpected: finalTopics,
      questionsCompleted: finalQuestions,
      questionsExpected: finalQuestions,
      contentReady: true,
    },
  });

  log('\n=== PIPELINE COMPLETE ===');
  log('  Chapters:  ' + finalChapters);
  log('  Topics:    ' + finalTopics);
  log('  Notes:     ' + finalNotes);
  log('  Questions: ' + finalQuestions);
  log('\nRefresh the admin UI to see updated progress.');

  await p.$disconnect();
}

main().catch(async (e) => {
  console.error('Simulation failed:', e.message);
  await p.$disconnect();
  process.exit(1);
});
