/**
 * UNIT TESTS: Hydration Reconciler
 *
 * Tests for:
 * - Lock acquisition/release
 * - Level completion checks
 * - Child job creation
 * - Progress tracking
 * - Finalization logic
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Must mock before imports (jest hoists these)
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/lib/prisma.js', () => ({ prisma: require('../../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HydrationReconciler } from '@/worker/services/hydrationReconciler';
import { prismaMock, resetPrismaMock } from '../../../helpers/prismaMock';

describe('HydrationReconciler - Lock Management', () => {
  let reconciler: HydrationReconciler;

  beforeEach(() => {
    reconciler = new HydrationReconciler();
    resetPrismaMock();
  });

  it('should acquire lock successfully', async () => {
    prismaMock.$executeRaw.mockResolvedValue(1); // 1 row affected

    const acquired = await (reconciler as any).acquireLock();
    expect(acquired).toBe(true);
  });

  it('should fail to acquire lock if already held', async () => {
    prismaMock.$executeRaw.mockResolvedValue(0); // 0 rows affected (lock exists)

    const acquired = await (reconciler as any).acquireLock();
    expect(acquired).toBe(false);
  });

  it('should release lock after reconciliation', async () => {
    prismaMock.jobLock.delete.mockResolvedValue({ jobName: 'test' });

    await (reconciler as any).releaseLock();
    expect(prismaMock.jobLock.delete).toHaveBeenCalled();
  });
});

describe('HydrationReconciler - Level Completion', () => {
  let reconciler: HydrationReconciler;

  beforeEach(() => {
    reconciler = new HydrationReconciler();
    resetPrismaMock();
  });

  it('should detect when level is complete', async () => {
    prismaMock.hydrationJob.groupBy.mockResolvedValue([
      { status: 'completed', _count: 5 },
      { status: 'failed', _count: 1 },
    ]);

    const isComplete = await (reconciler as any).isLevelComplete('root123', 1);
    expect(isComplete).toBe(true);
  });

  it('should detect when level is incomplete', async () => {
    prismaMock.hydrationJob.groupBy.mockResolvedValue([
      { status: 'completed', _count: 3 },
      { status: 'running', _count: 2 },
      { status: 'pending', _count: 1 },
    ]);

    const isComplete = await (reconciler as any).isLevelComplete('root123', 1);
    expect(isComplete).toBe(false);
  });

  it('should return false when no jobs exist at level', async () => {
    prismaMock.hydrationJob.groupBy.mockResolvedValue([]);

    const isComplete = await (reconciler as any).isLevelComplete('root123', 1);
    expect(isComplete).toBe(false);
  });
});

describe('HydrationReconciler - Child Job Creation', () => {
  let reconciler: HydrationReconciler;

  beforeEach(() => {
    reconciler = new HydrationReconciler();
    resetPrismaMock();
  });

  it('should create Level 2 jobs (topics) when Level 1 completes', async () => {
    const rootJob = {
      id: 'root123',
      subjectId: 'subject456',
      language: 'en',
      difficulty: 'medium',
    };

    const topics = [
      { id: 'tp1', order: 1, chapter: { id: 'ch1' } },
      { id: 'tp2', order: 2, chapter: { id: 'ch1' } },
      { id: 'tp3', order: 3, chapter: { id: 'ch2' } },
    ];

    prismaMock.hydrationJob.count.mockResolvedValue(0); // No existing Level 2 jobs
    prismaMock.hydrationJob.create.mockResolvedValue({ id: 'child-job' });
    prismaMock.outbox.create.mockResolvedValue({ id: 'outbox-entry' });
    prismaMock.topicDef.findMany.mockResolvedValue(topics);
    prismaMock.$transaction.mockImplementation(async (callback: any) => await callback(prismaMock));

    await (reconciler as any).createLevel2Jobs(rootJob);

    // Should create 3 child jobs (one per topic)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
  });

  it('should skip Level 2 creation if already created', async () => {
    const rootJob = { id: 'root123' };

    prismaMock.hydrationJob.count.mockResolvedValue(5); // Existing jobs

    await (reconciler as any).createLevel2Jobs(rootJob);

    expect(prismaMock.topicDef.findMany).not.toHaveBeenCalled();
  });

  it('should create child job with Outbox pattern', async () => {
    const params = {
      rootJobId: 'root123',
      level: 2,
      jobType: 'notes',
      entityId: 'chapter456',
      entityType: 'CHAPTER',
      language: 'en',
      difficulty: 'medium',
    };

    const mockTx = {
      hydrationJob: {
        create: jest.fn().mockResolvedValue({ id: 'child123' }),
      },
      outbox: {
        create: jest.fn().mockResolvedValue({ id: 'outbox123' }),
      },
    };

    prismaMock.$transaction.mockImplementation(async (callback) => await callback(mockTx));

    await (reconciler as any).createChildJob(params);

    expect(mockTx.hydrationJob.create).toHaveBeenCalled();
    expect(mockTx.outbox.create).toHaveBeenCalled();
  });
});

describe('HydrationReconciler - Progress Tracking', () => {
  let reconciler: HydrationReconciler;

  beforeEach(() => {
    reconciler = new HydrationReconciler();
    resetPrismaMock();
  });

  it('should update progress counters correctly', async () => {
    const rootJobId = 'root123';
    const subjectId = 'subject456';

    prismaMock.hydrationJob.findUnique.mockResolvedValue({ subjectId });
    prismaMock.chapterDef.count.mockResolvedValue(8);
    prismaMock.topicDef.count.mockResolvedValue(35);
    prismaMock.topicNote.count.mockResolvedValue(20);
    prismaMock.generatedQuestion.count.mockResolvedValue(150);

    await (reconciler as any).updateProgress(rootJobId);

    expect(prismaMock.hydrationJob.update).toHaveBeenCalledWith({
      where: { id: rootJobId },
      data: expect.objectContaining({
        chaptersCompleted: 8,
        topicsCompleted: 35,
        notesCompleted: 20,
        questionsCompleted: 150,
      }),
    });
  });
});

describe('HydrationReconciler - Finalization', () => {
  let reconciler: HydrationReconciler;

  beforeEach(() => {
    reconciler = new HydrationReconciler();
    resetPrismaMock();
  });

  it('should mark root job as completed when all children succeed', async () => {
    const rootJob = { id: 'root123' };

    prismaMock.hydrationJob.count.mockResolvedValue(0); // No failed children

    await (reconciler as any).finalizeRootJob(rootJob);

    expect(prismaMock.hydrationJob.update).toHaveBeenCalledWith({
      where: { id: 'root123' },
      data: expect.objectContaining({
        status: 'completed',
      }),
    });
  });

  it('should mark root job as failed when any child fails', async () => {
    const rootJob = { id: 'root123' };

    prismaMock.hydrationJob.count.mockResolvedValue(3); // 3 failed children

    await (reconciler as any).finalizeRootJob(rootJob);

    expect(prismaMock.hydrationJob.update).toHaveBeenCalledWith({
      where: { id: 'root123' },
      data: expect.objectContaining({
        status: 'failed',
      }),
    });
  });

});

describe('HydrationReconciler - Full Reconciliation Flow', () => {
  let reconciler: HydrationReconciler;

  beforeEach(() => {
    reconciler = new HydrationReconciler();
    resetPrismaMock();
  });

  it('should handle full reconciliation cycle', async () => {
    // Mock lock acquisition
    prismaMock.$executeRaw.mockResolvedValue(1);

    // Mock root jobs
    prismaMock.hydrationJob.findMany.mockResolvedValue([
      {
        id: 'root123',
        status: 'running',
        subjectId: 'subject456',
        language: 'en',
        difficulty: 'medium',
      },
    ]);

    // Mock level completion checks (all incomplete)
    prismaMock.hydrationJob.groupBy.mockResolvedValue([
      { status: 'running', _count: 2 },
    ]);

    await reconciler.reconcile();

    expect(prismaMock.$executeRaw).toHaveBeenCalled(); // Lock acquired
    expect(prismaMock.hydrationJob.findMany).toHaveBeenCalled(); // Root jobs fetched
  });

  it('should skip reconciliation if lock cannot be acquired', async () => {
    prismaMock.$executeRaw.mockResolvedValue(0); // Lock acquisition fails

    await reconciler.reconcile();

    expect(prismaMock.hydrationJob.findMany).not.toHaveBeenCalled();
  });
});
