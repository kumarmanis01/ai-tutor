/**
 * Unit tests for GET /api/v1/content/[topicId]/practice (S2.3).
 */

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { logAPI: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    topicDef: { findUnique: jest.fn() },
    question: { findMany: jest.fn() },
  },
}));

import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/v1/content/[topicId]/practice/route';

const mockSession = getServerSessionForHandlers as jest.Mock;
const mockTopicFind = prisma.topicDef.findUnique as jest.Mock;
const mockQuestionFind = prisma.question.findMany as jest.Mock;

function makeParams(topicId = 't1') {
  return { params: Promise.resolve({ topicId }) };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSession.mockResolvedValue({ user: { id: 'u1' } });
});

describe('GET /api/v1/content/[topicId]/practice', () => {
  it('should return 401 when no session', async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await GET(new Request('https://example.com/api/v1/content/t1/practice'), makeParams());
    expect(res.status).toBe(401);
  });

  it('should return 404 when topic not found', async () => {
    mockTopicFind.mockResolvedValueOnce(null);
    const res = await GET(new Request('https://example.com/api/v1/content/t1/practice'), makeParams());
    expect(res.status).toBe(404);
  });

  it('should return up to 5 questions by default', async () => {
    mockTopicFind.mockResolvedValueOnce({ id: 't1', name: 'Fractions' });
    mockQuestionFind.mockResolvedValueOnce([
      { id: 'q1', prompt: 'What is 1/2 + 1/2?', choices: ['A', 'B', 'C', 'D'], difficulty: 'easy', correctAnswer: 'C' },
      { id: 'q2', prompt: 'What is 1/4 of 8?', choices: ['A', 'B', 'C', 'D'], difficulty: 'medium', correctAnswer: 'A' },
    ]);

    const res = await GET(new Request('https://example.com/api/v1/content/t1/practice'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topicId).toBe('t1');
    expect(Array.isArray(body.questions)).toBe(true);
    expect(body.questions).toHaveLength(2);
  });

  it('should normalize string array choices to {key, label} objects', async () => {
    mockTopicFind.mockResolvedValueOnce({ id: 't1', name: 'Test' });
    mockQuestionFind.mockResolvedValueOnce([
      { id: 'q1', prompt: 'Test?', choices: ['Option 1', 'Option 2', 'Option 3', 'Option 4'], difficulty: 'easy', correctAnswer: 'C' },
    ]);

    const res = await GET(new Request('https://example.com/api/v1/content/t1/practice'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions[0].options[0]).toMatchObject({ key: 'A', label: 'Option 1' });
    expect(body.questions[0].options[1]).toMatchObject({ key: 'B', label: 'Option 2' });
  });

  it('should cap count at 10 even if query param is higher', async () => {
    mockTopicFind.mockResolvedValueOnce({ id: 't1', name: 'Test' });
    mockQuestionFind.mockResolvedValueOnce([]);

    await GET(new Request('https://example.com/api/v1/content/t1/practice?count=50'), makeParams());
    const callArgs = (mockQuestionFind as jest.Mock).mock.calls[0][0] as { take?: number };
    expect(callArgs.take).toBeLessThanOrEqual(10);
  });

  it('should return empty questions array when no questions exist', async () => {
    mockTopicFind.mockResolvedValueOnce({ id: 't1', name: 'Empty Topic' });
    mockQuestionFind.mockResolvedValueOnce([]);
    const res = await GET(new Request('https://example.com/api/v1/content/t1/practice'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toEqual([]);
  });
});
