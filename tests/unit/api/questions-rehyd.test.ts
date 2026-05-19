/**
 * UNIT TESTS: POST /api/admin/content-engine/questions-rehyd
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn().mockResolvedValue({
    user: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
  }),
}));
jest.mock('@/lib/execution-pipeline/enqueueTopicHydration', () => ({
  enqueueQuestionsHydration: jest.fn(),
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock';
import { enqueueQuestionsHydration } from '@/lib/execution-pipeline/enqueueTopicHydration';

const mockEnqueue = enqueueQuestionsHydration as jest.MockedFunction<typeof enqueueQuestionsHydration>;

const MOCK_SUBJECT = {
  id: 'subj-1',
  name: 'Science',
  class: { grade: 8, board: { name: 'CBSE' } },
};
const MOCK_TOPICS = [{ id: 'topic-1' }, { id: 'topic-2' }];

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/content-engine/questions-rehyd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/content-engine/questions-rehyd', () => {
  beforeEach(() => {
    resetPrismaMock();
    mockEnqueue.mockReset();
  });

  it('should enqueue jobs for all topics x 3 difficulties when not paused', async () => {
    prismaMock.subjectDef.findUnique.mockResolvedValue(MOCK_SUBJECT as any);
    prismaMock.topicDef.findMany.mockResolvedValue(MOCK_TOPICS as any);
    mockEnqueue.mockResolvedValue({ created: true, jobId: 'job-x' });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' } as any);

    const { POST } = await import('@/app/api/admin/content-engine/questions-rehyd/route');
    const res = await POST(makeRequest({ subjectId: 'subj-1' }) as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    // 2 topics x 3 difficulties = 6 jobs
    expect(data.enqueued).toBe(6);
    expect(data.skipped).toBe(0);
    expect(data.topicCount).toBe(2);
    expect(mockEnqueue).toHaveBeenCalledTimes(6);
    // Verify force=true is always passed
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ force: true }));
  });

  it('should stop immediately when hydration_paused is returned', async () => {
    prismaMock.subjectDef.findUnique.mockResolvedValue(MOCK_SUBJECT as any);
    prismaMock.topicDef.findMany.mockResolvedValue(MOCK_TOPICS as any);
    // First call succeeds, second returns paused
    mockEnqueue
      .mockResolvedValueOnce({ created: true, jobId: 'job-1' })
      .mockResolvedValue({ created: false, reason: 'hydration_paused' });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' } as any);

    const { POST } = await import('@/app/api/admin/content-engine/questions-rehyd/route');
    const res = await POST(makeRequest({ subjectId: 'subj-1' }) as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.enqueued).toBe(1);
    // Stops after the paused response -- does not continue remaining topics/difficulties
    expect(mockEnqueue.mock.calls.length).toBeLessThan(6);
    expect(data.message).toContain('Stopped early');
  });

  it('should return 400 when subjectId is missing', async () => {
    const { POST } = await import('@/app/api/admin/content-engine/questions-rehyd/route');
    const res = await POST(makeRequest({ language: 'en' }) as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('missing_fields');
  });

  it('should return 400 for invalid language', async () => {
    const { POST } = await import('@/app/api/admin/content-engine/questions-rehyd/route');
    const res = await POST(makeRequest({ subjectId: 'subj-1', language: 'fr' }) as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_language');
  });

  it('should return 400 for non-integer questionsPerDifficulty', async () => {
    const { POST } = await import('@/app/api/admin/content-engine/questions-rehyd/route');
    const res = await POST(makeRequest({ subjectId: 'subj-1', questionsPerDifficulty: 'abc' }) as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_questionsPerDifficulty');
  });

  it('should return 400 for negative questionsPerDifficulty', async () => {
    const { POST } = await import('@/app/api/admin/content-engine/questions-rehyd/route');
    const res = await POST(makeRequest({ subjectId: 'subj-1', questionsPerDifficulty: -1 }) as any);
    expect(res.status).toBe(400);
  });

  it('should clamp questionsPerDifficulty to max of 10', async () => {
    prismaMock.subjectDef.findUnique.mockResolvedValue(MOCK_SUBJECT as any);
    prismaMock.topicDef.findMany.mockResolvedValue([{ id: 'topic-1' }] as any);
    mockEnqueue.mockResolvedValue({ created: true, jobId: 'job-x' });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' } as any);

    const { POST } = await import('@/app/api/admin/content-engine/questions-rehyd/route');
    await POST(makeRequest({ subjectId: 'subj-1', questionsPerDifficulty: 50 }) as any);

    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ questionsPerDifficulty: 10 }),
    );
  });

  it('should return 404 when subject is not found', async () => {
    prismaMock.subjectDef.findUnique.mockResolvedValue(null);
    const { POST } = await import('@/app/api/admin/content-engine/questions-rehyd/route');
    const res = await POST(makeRequest({ subjectId: 'missing' }) as any);
    expect(res.status).toBe(404);
  });

  it('should return 401 when session is missing', async () => {
    const { getServerSessionForHandlers } = await import('@/lib/session');
    (getServerSessionForHandlers as jest.MockedFunction<any>).mockResolvedValueOnce(null);

    const { POST } = await import('@/app/api/admin/content-engine/questions-rehyd/route');
    const res = await POST(makeRequest({ subjectId: 'subj-1' }) as any);
    expect(res.status).toBe(401);
  });

  it('should count skipped jobs and continue when job_already_queued', async () => {
    prismaMock.subjectDef.findUnique.mockResolvedValue(MOCK_SUBJECT as any);
    prismaMock.topicDef.findMany.mockResolvedValue([{ id: 'topic-1' }] as any);
    mockEnqueue
      .mockResolvedValueOnce({ created: true, jobId: 'job-1' })
      .mockResolvedValue({ created: false, reason: 'job_already_queued', jobId: 'job-existing' });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' } as any);

    const { POST } = await import('@/app/api/admin/content-engine/questions-rehyd/route');
    const res = await POST(makeRequest({ subjectId: 'subj-1' }) as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.enqueued).toBe(1);
    expect(data.skipped).toBe(2); // medium and hard skipped
    expect(mockEnqueue).toHaveBeenCalledTimes(3); // all 3 difficulties attempted
  });
});
