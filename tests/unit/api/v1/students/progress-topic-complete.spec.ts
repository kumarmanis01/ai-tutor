/**
 * Unit tests for POST /api/v1/students/[studentId]/progress/topic/[topicId]/complete (S2.2).
 */

const mockTransaction = jest.fn();

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    topicDef: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/v1/students/[studentId]/progress/topic/[topicId]/complete/route';

const mockSession = getServerSessionForHandlers as jest.Mock;
const mockTopicFind = prisma.topicDef.findUnique as jest.Mock;
const mockTx = prisma.$transaction as jest.Mock;

function makeParams(studentId = 's1', topicId = 't1') {
  return { params: Promise.resolve({ studentId, topicId }) };
}

function makeRequest() {
  return new Request('https://example.com/api/v1/students/s1/progress/topic/t1/complete', { method: 'POST' });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSession.mockResolvedValue({ user: { id: 's1' } });
  mockTx.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const mockTxClient = {
      studentTopicProgress: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      studentTopicMastery: { upsert: jest.fn().mockResolvedValue({}) },
    };
    return fn(mockTxClient);
  });
});

describe('POST /api/v1/students/[studentId]/progress/topic/[topicId]/complete', () => {
  it('should return 401 when no session', async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('should return 403 when userId does not match studentId', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'other' } });
    const res = await POST(makeRequest(), makeParams('s1'));
    expect(res.status).toBe(403);
  });

  it('should return 404 when topic not found', async () => {
    mockTopicFind.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it('should return ok: true and completedAt for valid topic completion', async () => {
    mockTopicFind.mockResolvedValueOnce({
      id: 't1',
      chapter: { name: 'Chapter 1', subject: { name: 'Maths' } },
    });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.topicId).toBe('t1');
    expect(body.completedAt).toBeTruthy();
  });

  it('should be idempotent - completing already completed topic does not throw', async () => {
    mockTopicFind.mockResolvedValueOnce({
      id: 't1',
      chapter: { name: 'Chapter 1', subject: { name: 'Maths' } },
    });
    mockTx.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
      const mockTxClient = {
        studentTopicProgress: {
          findUnique: jest.fn().mockResolvedValue({ mastery: 0.8, practiceCount: 3 }),
          upsert: jest.fn().mockResolvedValue({}),
        },
        studentTopicMastery: { upsert: jest.fn().mockResolvedValue({}) },
      };
      return fn(mockTxClient);
    });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
