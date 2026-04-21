/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Unit tests for lib/diagnostics/enqueueSubjectHydration
 *
 * Verifies all four idempotency rules:
 *   1. Topics already exist  -> triggered:false, reason:'topics_exist'
 *   2. Job already running   -> triggered:false, reason:'job_running'
 *   3. SubjectDef not found  -> triggered:false, reason:'subject_not_found'
 *   4. Happy path            -> triggered:true,  reason:'created'
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

describe('enqueueSubjectHydration', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('should return triggered:false when topics already exist (rule 1)', async () => {
    prismaMock.topicDef.count.mockResolvedValue(5);
    const { enqueueSubjectHydration } = await import('@/lib/diagnostics/enqueueSubjectHydration');
    const result = await enqueueSubjectHydration(SUBJECT_ID, LANGUAGE, 'test');
    expect(result).toEqual({ triggered: false, jobId: null, reason: 'topics_exist' });
    expect(prismaMock.hydrationJob.findFirst).not.toHaveBeenCalled();
  });

  it('should return existing jobId when root syllabus job is already running (rule 2)', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.hydrationJob.findFirst.mockResolvedValue({ id: 'existing-job-1' });
    const { enqueueSubjectHydration } = await import('@/lib/diagnostics/enqueueSubjectHydration');
    const result = await enqueueSubjectHydration(SUBJECT_ID, LANGUAGE, 'test');
    expect(result).toEqual({ triggered: false, jobId: 'existing-job-1', reason: 'job_running' });
    expect(prismaMock.subjectDef.findUnique).not.toHaveBeenCalled();
  });

  it('should return triggered:false when SubjectDef is not found (rule 3)', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.hydrationJob.findFirst.mockResolvedValue(null);
    prismaMock.subjectDef.findUnique.mockResolvedValue(null);
    const { enqueueSubjectHydration } = await import('@/lib/diagnostics/enqueueSubjectHydration');
    const result = await enqueueSubjectHydration(SUBJECT_ID, LANGUAGE, 'test');
    expect(result).toEqual({ triggered: false, jobId: null, reason: 'subject_not_found' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('should create HydrationJob and return triggered:true (rule 4 -- happy path)', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.hydrationJob.findFirst.mockResolvedValue(null);
    prismaMock.subjectDef.findUnique.mockResolvedValue(SUBJECT_DEF);

    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const txHydrationCreate = jest.fn().mockResolvedValue({ id: 'new-job-99' });
      const txOutboxCreate = jest.fn().mockResolvedValue({});
      await fn({
        hydrationJob: { create: txHydrationCreate },
        outbox: { create: txOutboxCreate },
      });
      expect(txHydrationCreate).toHaveBeenCalledWith(
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
      expect(txOutboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queue: 'content-hydration',
          }),
        }),
      );
      return { id: 'new-job-99' };
    });

    const { enqueueSubjectHydration } = await import('@/lib/diagnostics/enqueueSubjectHydration');
    const result = await enqueueSubjectHydration(SUBJECT_ID, LANGUAGE, 'onboarding');
    expect(result).toEqual({ triggered: true, jobId: 'new-job-99', reason: 'created' });
  });

  it('should use the provided triggeredBy value in the job inputParams', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.hydrationJob.findFirst.mockResolvedValue(null);
    prismaMock.subjectDef.findUnique.mockResolvedValue(SUBJECT_DEF);

    let capturedData: any;
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const txCreate = jest.fn().mockImplementation((args: any) => {
        capturedData = args.data;
        return Promise.resolve({ id: 'job-x' });
      });
      return fn({
        hydrationJob: { create: txCreate },
        outbox: { create: jest.fn().mockResolvedValue({}) },
      });
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
