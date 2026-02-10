/**
 * FILE: Hydration Reconciler Service
 *
 * OBJECTIVE:
 * Orchestrates the cascade of HydrateAll jobs across hierarchical levels.
 *
 * RESPONSIBILITIES:
 * 1. Poll root HydrationJobs with incomplete children
 * 2. Check completion status of each hierarchical level
 * 3. Create child jobs when parent level completes
 * 4. Update progress counters on root job
 * 5. Mark root job as completed when all levels done
 *
 * ARCHITECTURE:
 * - Runs as scheduled job (cron: every 5 minutes)
 * - Uses JobLock to ensure single reconciler instance
 * - Short transactions for all DB operations
 * - Creates child jobs in Outbox pattern
 *
 * LINKED DOCS:
 * - /Docs/HYDRATEALL_IMPLEMENTATION_GUIDE.md
 * - /Docs/HYDRATEALL_FINAL_ARCHITECTURE.md
 */

import { prisma } from '@/lib/prisma.js';
import { logger } from '@/lib/logger.js';
import { JobStatus } from '@/lib/ai-engine/types';
import { JobType, DifficultyLevel } from '@prisma/client';

const RECONCILER_LOCK_NAME = 'hydration_reconciler';
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ============================================
// Main Reconciler Class
// ============================================

export class HydrationReconciler {
  private isRunning = false;

  /**
   * Main reconciliation loop
   */
  async reconcile(): Promise<void> {
    // Prevent concurrent executions
    if (this.isRunning) {
      logger.debug('Reconciler already running, skipping this cycle');
      return;
    }

    this.isRunning = true;

    try {
      // Acquire distributed lock
      const lockAcquired = await this.acquireLock();
      if (!lockAcquired) {
        logger.debug('Failed to acquire reconciler lock, another instance is running');
        return;
      }

      logger.info('Starting hydration reconciliation cycle');

      // Get root jobs needing reconciliation
      const rootJobs = await this.getRootJobsForReconciliation();

      logger.info(`Found ${rootJobs.length} root jobs to reconcile`);

      // Reconcile each root job
      for (const rootJob of rootJobs) {
        try {
          await this.reconcileRootJob(rootJob);
        } catch (error: any) {
          logger.error('Failed to reconcile root job', {
            rootJobId: rootJob.id,
            error: error.message,
            stack: error.stack,
          });
        }
      }

      logger.info('Hydration reconciliation cycle completed');
    } catch (error: any) {
      logger.error('Reconciliation cycle failed', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
      await this.releaseLock();
    }
  }

  // ============================================
  // Lock Management
  // ============================================

  private async acquireLock(): Promise<boolean> {
    try {
      const now = new Date();
      const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);

      // Try to acquire or update lock
      const result = await prisma.$executeRaw`
        INSERT INTO "JobLock" ("jobName", "lockedUntil", "createdAt", "updatedAt")
        VALUES (${RECONCILER_LOCK_NAME}, ${lockedUntil}, ${now}, ${now})
        ON CONFLICT ("jobName")
        DO UPDATE SET
          "lockedUntil" = ${lockedUntil},
          "updatedAt" = ${now}
        WHERE "JobLock"."lockedUntil" < ${now}
      `;

      return result > 0;
    } catch (error: any) {
      logger.error('Failed to acquire lock', { error: error.message });
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await prisma.jobLock.delete({
        where: { jobName: RECONCILER_LOCK_NAME },
      });
    } catch (error: any) {
      // Lock might have already expired, that's okay
      logger.debug('Failed to release lock (might have expired)', {
        error: error.message,
      });
    }
  }

  // ============================================
  // Root Job Discovery
  // ============================================

  private async getRootJobsForReconciliation() {
    // Get root jobs that are:
    // 1. Not completed/failed/cancelled
    // 2. Either pending or running
    // 3. Root jobs (rootJobId is null)
    return await prisma.hydrationJob.findMany({
      where: {
        rootJobId: null, // This IS the root
        status: {
          in: [JobStatus.Pending, JobStatus.Running],
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100, // Process in batches
    });
  }

  // ============================================
  // Root Job Reconciliation
  // ============================================

  private async reconcileRootJob(rootJob: any): Promise<void> {
    logger.debug('Reconciling root job', {
      rootJobId: rootJob.id,
      status: rootJob.status,
      subject: rootJob.subject,
    });

    // Level 1 (Syllabus): The root job IS the syllabus.
    // The syllabus worker sets contentReady=true when chapters/topics are created.
    // Once ready, create Level 2 (notes per topic).
    if (rootJob.contentReady) {
      await this.createLevel2Jobs(rootJob); // Notes per topic
    }

    // Level 2 (Notes): Once all topic notes are done, create Level 3 (questions).
    const level2Complete = await this.isLevelComplete(rootJob.id, 2);
    if (level2Complete) {
      await this.createLevel3Jobs(rootJob); // Questions per topic × difficulty
    }

    // Level 3 (Questions): Once all questions are done, finalize the root job.
    const level3Complete = await this.isLevelComplete(rootJob.id, 3);
    if (level3Complete) {
      await this.finalizeRootJob(rootJob);
    }

    // Update progress counters
    await this.updateProgress(rootJob.id);
  }

  // ============================================
  // Level Completion Checks
  // ============================================

  private async isLevelComplete(rootJobId: string, level: number): Promise<boolean> {
    // Check if all jobs at this level are in terminal state
    const counts = await prisma.hydrationJob.groupBy({
      by: ['status'],
      where: {
        rootJobId,
        hierarchyLevel: level,
      },
      _count: true,
    });

    const totalJobs = counts.reduce((sum, c) => sum + c._count, 0);
    const terminalJobs = counts
      .filter((c) => ['completed', 'failed', 'cancelled'].includes(c.status))
      .reduce((sum, c) => sum + c._count, 0);

    // If no jobs at this level yet, it's not complete
    if (totalJobs === 0) return false;

    // All jobs must be in terminal state
    return totalJobs === terminalJobs;
  }

  // ============================================
  // Child Job Creation
  // ============================================

  /**
   * Level 2: Create note generation jobs for each topic
   */
  private async createLevel2Jobs(rootJob: any): Promise<void> {
    const existingLevel2 = await prisma.hydrationJob.count({
      where: { rootJobId: rootJob.id, hierarchyLevel: 2 },
    });

    if (existingLevel2 > 0) {
      logger.debug('Level 2 jobs already created', { rootJobId: rootJob.id });
      return;
    }

    const subjectId = rootJob.subjectId;
    if (!subjectId) {
      logger.warn('No subjectId on root job, cannot create Level 2 jobs', {
        rootJobId: rootJob.id,
      });
      return;
    }

    // Get all topics created by the syllabus worker
    const topics = await prisma.topicDef.findMany({
      where: {
        chapter: { subjectId },
        lifecycle: 'active',
      },
      include: { chapter: { select: { id: true } } },
      orderBy: { order: 'asc' },
    });

    logger.info(`Creating ${topics.length} Level 2 jobs (notes) for root job ${rootJob.id}`);

    for (const topic of topics) {
      await this.createChildJob({
        rootJobId: rootJob.id,
        level: 2,
        jobType: JobType.notes,
        topicId: topic.id,
        chapterId: topic.chapter.id,
        language: rootJob.language,
        difficulty: rootJob.difficulty,
      });
    }
  }

  /**
   * Level 3: Create question generation jobs for each topic × difficulty
   */
  private async createLevel3Jobs(rootJob: any): Promise<void> {
    const existingLevel3 = await prisma.hydrationJob.count({
      where: { rootJobId: rootJob.id, hierarchyLevel: 3 },
    });

    if (existingLevel3 > 0) {
      logger.debug('Level 3 jobs already created', { rootJobId: rootJob.id });
      return;
    }

    const topics = await prisma.topicDef.findMany({
      where: {
        chapter: { subjectId: rootJob.subjectId },
        lifecycle: 'active',
      },
      include: { chapter: { select: { id: true } } },
    });

    const inputParams = rootJob.inputParams || {};
    const difficulties: DifficultyLevel[] = inputParams.options?.difficulties || [
      'easy',
      'medium',
      'hard',
    ];

    const totalJobs = topics.length * difficulties.length;
    logger.info(`Creating ${totalJobs} Level 3 jobs (questions) for root job ${rootJob.id}`);

    for (const topic of topics) {
      for (const difficulty of difficulties) {
        await this.createChildJob({
          rootJobId: rootJob.id,
          level: 3,
          jobType: JobType.questions,
          topicId: topic.id,
          chapterId: topic.chapter.id,
          language: rootJob.language,
          difficulty,
        });
      }
    }
  }

  /**
   * Generic child job creator (uses Outbox pattern)
   */
  private async createChildJob(params: {
    rootJobId: string;
    level: number;
    jobType: JobType;
    topicId: string;
    chapterId: string;
    language: any;
    difficulty: DifficultyLevel;
  }): Promise<void> {
    const { rootJobId, level, jobType, topicId, chapterId, language, difficulty } = params;

    await prisma.$transaction(async (tx) => {
      // Create HydrationJob with topicId/chapterId columns populated
      // so workers can read them directly (e.g. job.topicId)
      const childJob = await tx.hydrationJob.create({
        data: {
          rootJobId,
          hierarchyLevel: level,
          jobType,
          topicId,
          chapterId,
          language,
          difficulty,
          status: JobStatus.Pending,
          attempts: 0,
          maxAttempts: 3,
          inputParams: {
            topicId,
            chapterId,
          },
        },
      });

      // Create Outbox entry for transactional queueing
      await tx.outbox.create({
        data: {
          queue: 'content-hydration',
          payload: {
            type: String(jobType).toUpperCase(),
            payload: { jobId: childJob.id },
          },
          meta: {
            hydrationJobId: childJob.id,
            topicId,
            chapterId,
            level,
          },
        },
      });
    });
  }

  // ============================================
  // Progress Tracking
  // ============================================

  private async updateProgress(rootJobId: string): Promise<void> {
    // Count actual content created
    const subjectId = await prisma.hydrationJob
      .findUnique({
        where: { id: rootJobId },
        select: { subjectId: true },
      })
      .then((job) => job?.subjectId);

    if (!subjectId) return;

    // --- Expected counts (from child jobs) ---
    const notesExpected = await prisma.hydrationJob.count({
      where: { rootJobId, hierarchyLevel: 2 },
    });

    const questionsExpected = await prisma.hydrationJob.count({
      where: { rootJobId, hierarchyLevel: 3 },
    });

    // --- Completed counts (actual content rows) ---
    const chaptersCompleted = await prisma.chapterDef.count({
      where: { subjectId, lifecycle: 'active' },
    });

    const topicsCompleted = await prisma.topicDef.count({
      where: {
        chapter: { subjectId },
        lifecycle: 'active',
      },
    });

    // Count all generated notes, not just approved ones.
    // Progress tracks generation, not admin approval.
    const notesCompleted = await prisma.topicNote.count({
      where: {
        topic: {
          chapter: { subjectId },
        },
      },
    });

    const questionsCompleted = await prisma.generatedQuestion.count({
      where: {
        test: {
          topic: {
            chapter: { subjectId },
          },
        },
      },
    });

    // Update root job with both expected and completed counts
    await prisma.hydrationJob.update({
      where: { id: rootJobId },
      data: {
        chaptersExpected: chaptersCompleted, // chapters are created atomically by syllabus
        topicsExpected: topicsCompleted,     // topics are created atomically by syllabus
        notesExpected,
        questionsExpected,
        chaptersCompleted,
        topicsCompleted,
        notesCompleted,
        questionsCompleted,
        updatedAt: new Date(),
      },
    });
  }

  // ============================================
  // Finalization
  // ============================================

  private async finalizeRootJob(rootJob: any): Promise<void> {
    logger.info('Finalizing root job', { rootJobId: rootJob.id });

    // Check for any failed children
    const failedChildren = await prisma.hydrationJob.count({
      where: {
        rootJobId: rootJob.id,
        status: JobStatus.Failed,
      },
    });

    const finalStatus = failedChildren > 0 ? JobStatus.Failed : JobStatus.Completed;

    await prisma.hydrationJob.update({
      where: { id: rootJob.id },
      data: {
        status: finalStatus,
        completedAt: new Date(),
      },
    });

    logger.info('Root job finalized', {
      rootJobId: rootJob.id,
      status: finalStatus,
      failedChildren,
    });
  }
}

// ============================================
// Singleton Instance
// ============================================

export const hydrationReconciler = new HydrationReconciler();

// ============================================
// Standalone Execution (for cron/scheduler)
// ============================================

if (process.argv[1]?.includes('hydrationReconciler')) {
  logger.info('Running hydration reconciler (standalone mode)');

  hydrationReconciler
    .reconcile()
    .then(() => {
      logger.info('Reconciler completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Reconciler failed', { error: error.message, stack: error.stack });
      process.exit(1);
    });
}
