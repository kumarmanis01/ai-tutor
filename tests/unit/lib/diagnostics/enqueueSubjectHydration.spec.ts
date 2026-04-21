/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Unit tests for lib/diagnostics/enqueueSubjectHydration
 *
 * Verifies all four idempotency rules:
 *   1. Topics already exist  -> triggered:false, reason:'topics_exist'   (no tx needed)
 *   2. Job already running   -> triggered:false, reason:'job_running'    (inside tx + advisory lock)
 *   3. SubjectDef not found  -> triggered:false, reason:'subject_not_found' (inside tx)
 *   4. Happy path            -> triggered:true,  reason:'created'        (inside tx)
 *
 * Rules 2-4 run inside a single Postgres transaction with a per-subject
 * advisory lock. The $transaction mock passes a shaped tx object so each
 * operation (findFirst, subjectDef.findUnique, hydrationJob.create, etc.)
 * can be asserted independently.
 */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/queues/constants', () => ({ CONTENT_HYDRATION_QUEUE: 'content-hydration' }));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../../helpers/prismaMock';

const SUBJECT_ID = 'sub-1';
const SUBJECT_DEF = {
  id: SUBJECT_ID,
  slug: 'mathematics',
  class: { grade: 10, board: { slug: 'cbse' } },
};
const LANGUAGE = 'en' as any;

/** Build a minimal tx mock. Callers can override individual fns. */
function makeTx(overrides: Record<string, any> = {}) {
  return {
    $executeRaw: jest.fn().mockResolvedValue([]),
    hydrationJob: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'new-job-99' }),
    },
    subjectDef: {
      findUnique: jest.fn().mockResolvedValue(SUBJECT_DEF),
    },
    outbox: {
      create: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

describe('enqueueSubjectHydration', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('should return triggered:false when topics already exist (rule 1 -- no transaction)', async () => {
    prismaMock.topicDef.count.mockResolvedValue(5);
    const { enqueueSubjectHydration } = await import('@/lib/diagnostics/enqueueSubjectHydration');
    const result = await enqueueSubjectHydration(SUBJECT_ID, LANGUAGE, 'test');
    expect(result).toEqual({ triggered: false, jobId: null, reason: 'topics_exist' });
    // Rule 1 exits before reaching the transaction
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('should return existing jobId when root syllabus job is already running (rule 2)', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    const txFindFirst = jest.fn().mockResolvedValue({ id: 'existing-job-1' });
    const txSubjectFind = jest.fn();
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = makeTx({
        hydrationJob: { findFirst: txFindFirst, create: jest.fn() },
        subjectDef: { findUnique: txSubjectFind },
      });
      return fn(tx);
    });
    const { enqueueSubjectHydration } = await import('@/lib/diagnostics/enqueueSubjectHydration');
    const result = await enqueueSubjectHydration(SUBJECT_ID, LANGUAGE, 'test');
    expect(result).toEqual({ triggered: false, jobId: 'existing-job-1', reason: 'job_running' });
    // subjectDef lookup is skipped once findFirst returns an existing job
    expect(txSubjectFind).not.toHaveBeenCalled();
  });

  it('should return triggered:false when SubjectDef is not found (rule 3)', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    const txCreate = jest.fn();
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = makeTx({
        subjectDef: { findUnique: jest.fn().mockResolvedValue(null) },
        hydrationJob: { findFirst: jest.fn().mockResolvedValue(null), create: txCreate },
      });
      return fn(tx);
    });
    const { enqueueSubjectHydration } = await import('@/lib/diagnostics/enqueueSubjectHydration');
    const result = await enqueueSubjectHydration(SUBJECT_ID, LANGUAGE, 'test');
    expect(result).toEqual({ triggered: false, jobId: null, reason: 'subject_not_found' });
    // hydrationJob.create is never called when subjectDef is missing
    expect(txCreate).not.toHaveBeenCalled();
  });

  it('should create HydrationJob and return triggered:true (rule 4 -- happy path)', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);

    let txHydrationCreate: jest.Mock;
    let txOutboxCreate: jest.Mock;

    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      txHydrationCreate = jest.fn().mockResolvedValue({ id: 'new-job-99' });
      txOutboxCreate = jest.fn().mockResolvedValue({});
      const tx = makeTx({
        hydrationJob: { findFirst: jest.fn().mockResolvedValue(null), create: txHydrationCreate },
        outbox: { create: txOutboxCreate },
      });
      return fn(tx);
    });

    const { enqueueSubjectHydration } = await import('@/lib/diagnostics/enqueueSubjectHydration');
    const result = await enqueueSubjectHydration(SUBJECT_ID, LANGUAGE, 'onboarding');
    expect(result).toEqual({ triggered: true, jobId: 'new-job-99', reason: 'created' });

    expect(txHydrationCreate!).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subjectId: SUBJECT_ID,
          board: 'cbse',
          grade: 10,
          subject: 'mathematics',
          hierarchyLevel: 0,
        }),
      }),
    );
    expect(txOutboxCreate!).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          queue: 'content-hydration',
        }),
      }),
    );
  });

  it('should acquire the advisory lock before the findFirst check', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    const callOrder: string[] = [];
    const txExecuteRaw = jest.fn().mockImplementation(() => { callOrder.push('lock'); return Promise.resolve([]); });
    const txFindFirst = jest.fn().mockImplementation(() => { callOrder.push('findFirst'); return Promise.resolve(null); });
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = makeTx({
        $executeRaw: txExecuteRaw,
        hydrationJob: { findFirst: txFindFirst, create: jest.fn().mockResolvedValue({ id: 'j1' }) },
      });
      return fn(tx);
    });
    const { enqueueSubjectHydration } = await import('@/lib/diagnostics/enqueueSubjectHydration');
    await enqueueSubjectHydration(SUBJECT_ID, LANGUAGE, 'test');
    expect(callOrder[0]).toBe('lock');
    expect(callOrder[1]).toBe('findFirst');
  });

  it('should use the provided triggeredBy value in the job inputParams', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    let capturedData: any;
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const txCreate = jest.fn().mockImplementation((args: any) => {
        capturedData = args.data;
        return Promise.resolve({ id: 'job-x' });
      });
      const tx = makeTx({
        hydrationJob: { findFirst: jest.fn().mockResolvedValue(null), create: txCreate },
      });
      return fn(tx);
    });
    const { enqueueSubjectHydration } = await import('@/lib/diagnostics/enqueueSubjectHydration');
    await enqueueSubjectHydration(SUBJECT_ID, LANGUAGE, 'student_on_demand');
    expect(capturedData?.inputParams?.triggeredBy).toBe('student_on_demand');
  });

  it('should propagate DB errors (never swallows)', async () => {
    prismaMock.topicDef.count.mockRejectedValue(new Error('DB unavailable'));
    const { enqueueSubjectHydration } = await import('@/lib/diagnostics/enqueueSubjectHydration');
    await expect(enqueueSubjectHydration(SUBJECT_ID, LANGUAGE)).rejects.toThrow('DB unavailable');
  });
});
