/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
/**
 * Unit tests for GET /api/student/diagnostic/check-ready
 * See: docs/v2/on-demand-generator.md
 */

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock';

const USER_ID = 'student-1';
const SUBJECT_ID = 'subject-abc';

function makeRequest(subjectId?: string) {
  const url = subjectId
    ? `http://localhost/api/student/diagnostic/check-ready?subjectId=${subjectId}`
    : 'http://localhost/api/student/diagnostic/check-ready';
  return new Request(url, { method: 'GET' });
}

describe('GET /api/student/diagnostic/check-ready', () => {
  let getServerSessionForHandlers: jest.Mock;

  beforeEach(() => {
    resetPrismaMock();
    getServerSessionForHandlers = require('@/lib/session').getServerSessionForHandlers;
    getServerSessionForHandlers.mockResolvedValue({ user: { id: USER_ID } });
  });

  it('should return 401 when unauthenticated', async () => {
    getServerSessionForHandlers.mockResolvedValue(null);
    const { GET } = await import('@/app/api/student/diagnostic/check-ready/route');
    const res = await GET(makeRequest(SUBJECT_ID) as any);
    expect(res.status).toBe(401);
  });

  it('should return 400 when subjectId is missing', async () => {
    const { GET } = await import('@/app/api/student/diagnostic/check-ready/route');
    const res = await GET(makeRequest() as any);
    expect(res.status).toBe(400);
  });

  it('should return phase "topics" when no TopicDef rows exist', async () => {
    prismaMock.topicDef.count.mockResolvedValue(0);
    const { GET } = await import('@/app/api/student/diagnostic/check-ready/route');
    const res = await GET(makeRequest(SUBJECT_ID) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ready: false, phase: 'topics' });
  });

  it('should return phase "questions" when topics exist but no questions', async () => {
    prismaMock.topicDef.count.mockResolvedValue(5);
    prismaMock.question.count.mockResolvedValue(0);
    prismaMock.generatedQuestion.count.mockResolvedValue(0);
    const { GET } = await import('@/app/api/student/diagnostic/check-ready/route');
    const res = await GET(makeRequest(SUBJECT_ID) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ready: false, phase: 'questions' });
  });

  it('should return ready when active Question rows exist', async () => {
    prismaMock.topicDef.count.mockResolvedValue(5);
    prismaMock.question.count.mockResolvedValue(15);
    const { GET } = await import('@/app/api/student/diagnostic/check-ready/route');
    const res = await GET(makeRequest(SUBJECT_ID) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ready: true, phase: 'ready' });
  });

  it('should return ready when GeneratedQuestion rows exist (no Question rows)', async () => {
    prismaMock.topicDef.count.mockResolvedValue(5);
    prismaMock.question.count.mockResolvedValue(0);
    prismaMock.generatedQuestion.count.mockResolvedValue(12);
    const { GET } = await import('@/app/api/student/diagnostic/check-ready/route');
    const res = await GET(makeRequest(SUBJECT_ID) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ready: true, phase: 'ready' });
  });

  it('should return 500 when DB throws', async () => {
    prismaMock.topicDef.count.mockRejectedValue(new Error('DB error'));
    const { GET } = await import('@/app/api/student/diagnostic/check-ready/route');
    const res = await GET(makeRequest(SUBJECT_ID) as any);
    expect(res.status).toBe(500);
  });
});
