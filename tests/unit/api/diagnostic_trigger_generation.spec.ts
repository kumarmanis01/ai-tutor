/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Unit tests for POST /api/student/diagnostic/trigger-generation
 * See: docs/v2/on-demand-generator.md
 */

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/queues/constants', () => ({ CONTENT_HYDRATION_QUEUE: 'content-hydration' }));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock';

const USER_ID = 'student-1';
const SUBJECT_ID = 'subject-abc';

const SUBJECT_DEF = {
  id: SUBJECT_ID,
  slug: 'mathematics',
  class: {
    grade: 10,
    board: { slug: 'cbse' },
  },
};

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/student/diagnostic/trigger-generation', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/student/diagnostic/trigger-generation', () => {
  let getServerSessionForHandlers: jest.Mock;

  beforeEach(() => {
    resetPrismaMock();
    getServerSessionForHandlers = require('@/lib/session').getServerSessionForHandlers;
    getServerSessionForHandlers.mockResolvedValue({ user: { id: USER_ID } });
  });

  it('should return 401 when unauthenticated', async () => {
    getServerSessionForHandlers.mockResolvedValue(null);
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(401);
  });

  it('should return 400 when subjectId is missing', async () => {
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({}) as any);
    expect(res.status).toBe(400);
  });

  it('should return phase "questions" when topics already exist', async () => {
    prismaMock.topicDef.count.mockResolvedValue(10);
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ triggered: false, phase: 'questions' });
  });

  it('should return existing jobId when hydration is already in flight', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.hydrationJob.findFirst.mockResolvedValue({ id: 'existing-job-1' });
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ triggered: false, phase: 'topics', jobId: 'existing-job-1' });
  });

  it('should return 404 when SubjectDef is not found', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.hydrationJob.findFirst.mockResolvedValue(null);
    prismaMock.subjectDef.findUnique.mockResolvedValue(null);
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(404);
  });

  it('should create HydrationJob and return triggered:true when no topics exist', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.hydrationJob.findFirst.mockResolvedValue(null);
    prismaMock.subjectDef.findUnique.mockResolvedValue(SUBJECT_DEF);
    prismaMock.user.findUnique.mockResolvedValue({ language: 'en' });
    prismaMock.$transaction.mockImplementation(async (fn: any) =>
      fn({
        hydrationJob: { create: jest.fn().mockResolvedValue({ id: 'new-job-1' }) },
        outbox: { create: jest.fn().mockResolvedValue({}) },
      }),
    );

    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.triggered).toBe(true);
    expect(body.phase).toBe('topics');
    expect(body.jobId).toBe('new-job-1');
  });

  it('should default language to en when student has no language set', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    prismaMock.hydrationJob.findFirst.mockResolvedValue(null);
    prismaMock.subjectDef.findUnique.mockResolvedValue(SUBJECT_DEF);
    prismaMock.user.findUnique.mockResolvedValue({ language: null });

    let capturedJobData: any;
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const mockCreate = jest.fn().mockImplementation((args: any) => {
        capturedJobData = args.data;
        return Promise.resolve({ id: 'new-job-2' });
      });
      return fn({
        hydrationJob: { create: mockCreate },
        outbox: { create: jest.fn().mockResolvedValue({}) },
      });
    });

    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(capturedJobData?.language).toBe('en');
  });

  it('should return 500 when DB throws', async () => {
    prismaMock.topicDef.count.mockRejectedValue(new Error('DB error'));
    const { POST } = await import('@/app/api/student/diagnostic/trigger-generation/route');
    const res = await POST(makeRequest({ subjectId: SUBJECT_ID }) as any);
    expect(res.status).toBe(500);
  });
});
