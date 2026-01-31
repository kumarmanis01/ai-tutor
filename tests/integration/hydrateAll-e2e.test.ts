/**
 * INTEGRATION TEST: HydrateAll End-to-End Flow
 *
 * Tests the complete cascade from submission to completion:
 * 1. Submit HydrateAll job via API
 * 2. Wait for reconciler to create Level 1 jobs
 * 3. Workers process syllabus generation
 * 4. Reconciler creates Level 2 jobs (topics)
 * 5. Workers process notes generation
 * 6. Reconciler creates Level 3 jobs (notes)
 * 7. Reconciler creates Level 4 jobs (questions)
 * 8. Workers process question generation
 * 9. Reconciler finalizes root job
 * 10. Verify all content created
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '@/lib/prisma';
import { hydrationReconciler } from '@/worker/services/hydrationReconciler';
import { JobStatus, LanguageCode, DifficultyLevel } from '@prisma/client';

// Test configuration
const TEST_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL = 5000; // 5 seconds

describe('HydrateAll End-to-End Integration Test', () => {
  let rootJobId: string;
  let testSubjectId: string;

  beforeAll(async () => {
    // Setup: Create test board, class, subject
    const board = await prisma.board.create({
      data: {
        name: 'Test Board',
        slug: 'test-board-e2e',
      },
    });

    const classLevel = await prisma.classLevel.create({
      data: {
        boardId: board.id,
        grade: 10,
        slug: 'grade-10-test',
      },
    });

    const subject = await prisma.subjectDef.create({
      data: {
        classId: classLevel.id,
        name: 'Test Subject',
        slug: 'test-subject-e2e',
      },
    });

    testSubjectId = subject.id;
  });

  afterAll(async () => {
    // Cleanup: Delete all test data
    if (rootJobId) {
      await prisma.hydrationJob.deleteMany({
        where: {
          OR: [
            { id: rootJobId },
            { rootJobId },
          ],
        },
      });
    }

    if (testSubjectId) {
      // Cascade delete will handle related entities
      await prisma.subjectDef.delete({
        where: { id: testSubjectId },
      });
    }
  });

  it(
    'should complete full HydrateAll cascade successfully',
    async () => {
      // ==================================
      // STEP 1: Submit HydrateAll Job
      // ==================================

      console.log('Step 1: Submitting HydrateAll job...');

      const rootJob = await prisma.$transaction(async (tx) => {
        const job = await tx.hydrationJob.create({
          data: {
            jobType: 'syllabus',
            subjectId: testSubjectId,
            language: 'en' as LanguageCode,
            difficulty: 'medium' as DifficultyLevel,
            status: JobStatus.pending,
            attempts: 0,
            maxAttempts: 3,
            chaptersExpected: 3, // Small test dataset
            topicsExpected: 9, // 3 chapters × 3 topics
            notesExpected: 9,
            questionsExpected: 27, // 9 topics × 3 difficulties × 1 question
            inputParams: {
              language: 'en',
              options: {
                generateNotes: true,
                generateQuestions: true,
                difficulties: ['easy', 'medium', 'hard'],
                questionsPerDifficulty: 1, // Reduced for faster test
              },
            },
          },
        });

        await tx.outbox.create({
          data: {
            queue: 'hydration',
            payload: {
              jobId: job.id,
              jobType: 'syllabus',
              subjectId: testSubjectId,
            },
          },
        });

        return job;
      });

      rootJobId = rootJob.id;
      console.log(`Root job created: ${rootJobId}`);

      // ==================================
      // STEP 2: Simulate Syllabus Worker
      // ==================================

      console.log('Step 2: Simulating syllabus worker execution...');

      // Create 3 test chapters
      const chapters = await Promise.all([
        prisma.chapterDef.create({
          data: {
            subjectId: testSubjectId,
            name: 'Chapter 1',
            slug: 'chapter-1',
            order: 1,
            status: 'approved',
          },
        }),
        prisma.chapterDef.create({
          data: {
            subjectId: testSubjectId,
            name: 'Chapter 2',
            slug: 'chapter-2',
            order: 2,
            status: 'approved',
          },
        }),
        prisma.chapterDef.create({
          data: {
            subjectId: testSubjectId,
            name: 'Chapter 3',
            slug: 'chapter-3',
            order: 3,
            status: 'approved',
          },
        }),
      ]);

      console.log(`Created ${chapters.length} chapters`);

      // Mark syllabus job as completed (normally done by worker)
      await prisma.hydrationJob.update({
        where: { id: rootJobId },
        data: { status: JobStatus.completed, chaptersCompleted: 3 },
      });

      // ==================================
      // STEP 3: Run Reconciler (Level 1→2)
      // ==================================

      console.log('Step 3: Running reconciler to create Level 2 jobs...');
      await hydrationReconciler.reconcile();

      // Verify Level 2 jobs created (one per chapter)
      const level2Jobs = await prisma.hydrationJob.findMany({
        where: { rootJobId, hierarchyLevel: 2 },
      });

      expect(level2Jobs).toHaveLength(3);
      console.log(`Created ${level2Jobs.length} Level 2 jobs`);

      // ==================================
      // STEP 4: Simulate Topic Creation
      // ==================================

      console.log('Step 4: Simulating topic creation...');

      // Create 3 topics per chapter
      for (const chapter of chapters) {
        await Promise.all([
          prisma.topicDef.create({
            data: {
              chapterId: chapter.id,
              name: `${chapter.name} - Topic 1`,
              slug: `${chapter.slug}-topic-1`,
              order: 1,
              status: 'approved',
            },
          }),
          prisma.topicDef.create({
            data: {
              chapterId: chapter.id,
              name: `${chapter.name} - Topic 2`,
              slug: `${chapter.slug}-topic-2`,
              order: 2,
              status: 'approved',
            },
          }),
          prisma.topicDef.create({
            data: {
              chapterId: chapter.id,
              name: `${chapter.name} - Topic 3`,
              slug: `${chapter.slug}-topic-3`,
              order: 3,
              status: 'approved',
            },
          }),
        ]);
      }

      const topics = await prisma.topicDef.findMany({
        where: {
          chapter: { subjectId: testSubjectId },
        },
      });

      expect(topics).toHaveLength(9);
      console.log(`Created ${topics.length} topics`);

      // Mark Level 2 jobs as completed
      await prisma.hydrationJob.updateMany({
        where: { rootJobId, hierarchyLevel: 2 },
        data: { status: JobStatus.completed },
      });

      // ==================================
      // STEP 5: Run Reconciler (Level 2→3)
      // ==================================

      console.log('Step 5: Running reconciler to create Level 3 jobs...');
      await hydrationReconciler.reconcile();

      const level3Jobs = await prisma.hydrationJob.findMany({
        where: { rootJobId, hierarchyLevel: 3 },
      });

      expect(level3Jobs).toHaveLength(9); // One per topic
      console.log(`Created ${level3Jobs.length} Level 3 jobs`);

      // ==================================
      // STEP 6: Simulate Note Generation
      // ==================================

      console.log('Step 6: Simulating note generation...');

      for (const topic of topics) {
        await prisma.topicNote.create({
          data: {
            topicId: topic.id,
            language: 'en' as LanguageCode,
            version: 1,
            status: 'approved',
            title: `Notes for ${topic.name}`,
            contentJson: {
              sections: [
                {
                  heading: 'Introduction',
                  content: 'Test content for integration test',
                },
              ],
            },
            source: 'ai-generated',
          },
        });
      }

      // Mark Level 3 jobs as completed
      await prisma.hydrationJob.updateMany({
        where: { rootJobId, hierarchyLevel: 3 },
        data: { status: JobStatus.completed },
      });

      // ==================================
      // STEP 7: Run Reconciler (Level 3→4)
      // ==================================

      console.log('Step 7: Running reconciler to create Level 4 jobs...');
      await hydrationReconciler.reconcile();

      const level4Jobs = await prisma.hydrationJob.findMany({
        where: { rootJobId, hierarchyLevel: 4 },
      });

      // 9 topics × 3 difficulties = 27 jobs
      expect(level4Jobs).toHaveLength(27);
      console.log(`Created ${level4Jobs.length} Level 4 jobs`);

      // ==================================
      // STEP 8: Simulate Question Generation
      // ==================================

      console.log('Step 8: Simulating question generation...');

      for (const topic of topics) {
        // Create test for each difficulty
        for (const difficulty of ['easy', 'medium', 'hard']) {
          const test = await prisma.generatedTest.create({
            data: {
              topicId: topic.id,
              title: `${topic.name} - ${difficulty} Test`,
              difficulty: difficulty as DifficultyLevel,
              language: 'en' as LanguageCode,
              version: 1,
              status: 'approved',
            },
          });

          // Create 1 question per test
          await prisma.generatedQuestion.create({
            data: {
              testId: test.id,
              type: 'MCQ',
              question: `Test question for ${topic.name} (${difficulty})`,
              options: {
                A: 'Option A',
                B: 'Option B',
                C: 'Option C',
                D: 'Option D',
              },
              answer: {
                correct: 'A',
                explanation: 'This is the correct answer for integration test',
              },
              marks: 1,
            },
          });
        }
      }

      // Mark Level 4 jobs as completed
      await prisma.hydrationJob.updateMany({
        where: { rootJobId, hierarchyLevel: 4 },
        data: { status: JobStatus.completed },
      });

      // ==================================
      // STEP 9: Final Reconciliation
      // ==================================

      console.log('Step 9: Running final reconciliation...');
      await hydrationReconciler.reconcile();

      // ==================================
      // STEP 10: Verify Final State
      // ==================================

      console.log('Step 10: Verifying final state...');

      // Check root job status
      const finalRootJob = await prisma.hydrationJob.findUnique({
        where: { id: rootJobId },
      });

      expect(finalRootJob?.status).toBe(JobStatus.completed);
      expect(finalRootJob?.chaptersCompleted).toBe(3);
      expect(finalRootJob?.topicsCompleted).toBe(9);
      expect(finalRootJob?.notesCompleted).toBe(9);
      expect(finalRootJob?.questionsCompleted).toBe(27);

      // Verify all content created
      const finalChapters = await prisma.chapterDef.count({
        where: { subjectId: testSubjectId, lifecycle: 'active' },
      });

      const finalTopics = await prisma.topicDef.count({
        where: {
          chapter: { subjectId: testSubjectId },
          lifecycle: 'active',
        },
      });

      const finalNotes = await prisma.topicNote.count({
        where: {
          topic: {
            chapter: { subjectId: testSubjectId },
          },
          status: 'approved',
        },
      });

      const finalQuestions = await prisma.generatedQuestion.count({
        where: {
          test: {
            topic: {
              chapter: { subjectId: testSubjectId },
            },
          },
        },
      });

      expect(finalChapters).toBe(3);
      expect(finalTopics).toBe(9);
      expect(finalNotes).toBe(9);
      expect(finalQuestions).toBe(27);

      console.log('✅ HydrateAll E2E test completed successfully!');
      console.log(`  - Chapters: ${finalChapters}`);
      console.log(`  - Topics: ${finalTopics}`);
      console.log(`  - Notes: ${finalNotes}`);
      console.log(`  - Questions: ${finalQuestions}`);
    },
    TEST_TIMEOUT
  );

  it('should handle validation failures and retry', async () => {
    // TODO: Test validation failure scenario
    // 1. Create job with invalid content
    // 2. Verify job marked as failed
    // 3. Verify retry attempt
    console.log('Validation failure test: TODO');
  });

  it('should handle concurrent job submissions', async () => {
    // TODO: Test concurrent submissions
    // 1. Submit 3 jobs simultaneously
    // 2. Verify no race conditions
    // 3. Verify all jobs complete
    console.log('Concurrent jobs test: TODO');
  });

  it('should ensure all questions have complete answers', async () => {
    // TODO: Test answer completeness validation
    // 1. Generate questions
    // 2. Verify all have correctAnswer field
    // 3. Verify answers have required fields (explanation, steps, etc.)
    console.log('Answer completeness test: TODO');
  });
});
