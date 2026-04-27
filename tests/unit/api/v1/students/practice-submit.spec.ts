/**
 * Unit tests for POST /api/v1/students/[studentId]/practice/submit (S2.3).
 */

const mockRedisGet = jest.fn();
const mockRedisIncrBy = jest.fn();
const mockRedisExpire = jest.fn();
const mockRedisInstance = { get: mockRedisGet, incrby: mockRedisIncrBy, expire: mockRedisExpire };

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    topicDef: { findUnique: jest.fn() },
    question: { findMany: jest.fn() },
  },
}));
jest.mock('@/lib/redis', () => ({ getRedis: jest.fn() }));
jest.mock('@/lib/learning/updateTopicProgress', () => ({ updateStudentTopicProgress: jest.fn() }));
jest.mock('@/lib/student/xp', () => ({ awardXP: jest.fn() }));

import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { POST } from '@/app/api/v1/students/[studentId]/practice/submit/route';

const mockSession = getServerSessionForHandlers as jest.Mock;
const mockUserFind = prisma.user.findUnique as jest.Mock;
const mockTopicFind = prisma.topicDef.findUnique as jest.Mock;
const mockQuestionFind = prisma.question.findMany as jest.Mock;
const mockGetRedis = getRedis as jest.Mock;

function makeParams(studentId = 's1') {
  return { params: Promise.resolve({ studentId }) };
}

function makeRequest(body: unknown) {
  return new Request('https://example.com/api/v1/students/s1/practice/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSession.mockResolvedValue({ user: { id: 's1' } });
  mockGetRedis.mockReturnValue(mockRedisInstance);
  mockRedisGet.mockResolvedValue(null);
  mockRedisIncrBy.mockResolvedValue(1);
  mockRedisExpire.mockResolvedValue(1);
});

describe('POST /api/v1/students/[studentId]/practice/submit', () => {
  it('should return 401 when no session', async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ topicId: 't1', answers: [] }), makeParams());
    expect(res.status).toBe(401);
  });

  it('should return 403 when userId does not match studentId', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'other' } });
    const res = await POST(makeRequest({ topicId: 't1', answers: [{ questionId: 'q1', answer: 'A' }] }), makeParams('s1'));
    expect(res.status).toBe(403);
  });

  it('should return 400 for invalid body', async () => {
    const res = await POST(
      new Request('https://example.com/api/v1/students/s1/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it('should return 400 when answers array is empty', async () => {
    const res = await POST(makeRequest({ topicId: 't1', answers: [] }), makeParams());
    expect(res.status).toBe(400);
  });

  it('should return 404 when topic not found', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'free' });
    mockTopicFind.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ topicId: 't1', answers: [{ questionId: 'q1', answer: 'A' }] }), makeParams());
    expect(res.status).toBe(404);
  });

  it('should return 429 FREEMIUM_LIMIT_REACHED when free student exceeds daily limit', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'free' });
    mockTopicFind.mockResolvedValueOnce({ id: 't1' });
    mockRedisGet.mockResolvedValueOnce('5');
    const res = await POST(makeRequest({ topicId: 't1', answers: [{ questionId: 'q1', answer: 'A' }] }), makeParams());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('FREEMIUM_LIMIT_REACHED');
  });

  it('should grade answers and return results for free student with remaining quota', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'free' });
    mockTopicFind.mockResolvedValueOnce({ id: 't1' });
    mockRedisGet.mockResolvedValue('0');
    mockQuestionFind.mockResolvedValueOnce([{ id: 'q1', prompt: 'What is 2+2?', correctAnswer: 'D' }]);
    mockRedisIncrBy.mockResolvedValueOnce(1);

    const res = await POST(makeRequest({ topicId: 't1', answers: [{ questionId: 'q1', answer: 'D' }] }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].isCorrect).toBe(true);
    expect(body.correctAnswers).toBe(1);
    expect(body.freemium).toBeDefined();
  });

  it('should not enforce freemium limit for premium students', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'active' });
    mockTopicFind.mockResolvedValueOnce({ id: 't1' });
    mockRedisGet.mockResolvedValue('99');
    mockQuestionFind.mockResolvedValueOnce([{ id: 'q1', prompt: 'Question?', correctAnswer: 'B' }]);

    const res = await POST(makeRequest({ topicId: 't1', answers: [{ questionId: 'q1', answer: 'A' }] }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.freemium.isPremium).toBe(true);
  });

  it('should correctly grade wrong answers', async () => {
    mockUserFind.mockResolvedValueOnce({ subscriptionStatus: 'free' });
    mockTopicFind.mockResolvedValueOnce({ id: 't1' });
    mockRedisGet.mockResolvedValue('0');
    mockQuestionFind.mockResolvedValueOnce([{ id: 'q1', prompt: 'What is 2+2?', correctAnswer: 'D' }]);
    mockRedisIncrBy.mockResolvedValueOnce(1);

    const res = await POST(makeRequest({ topicId: 't1', answers: [{ questionId: 'q1', answer: 'A' }] }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].isCorrect).toBe(false);
    expect(body.results[0].correctAnswer).toBe('D');
    expect(body.correctAnswers).toBe(0);
  });
});
