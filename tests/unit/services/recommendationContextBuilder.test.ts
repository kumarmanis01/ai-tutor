/**
 * Unit tests for buildRecommendationContext.
 * Mocks the Prisma client to avoid live DB calls.
 */

import { buildRecommendationContext } from '@/services/recommendationContextBuilder';

// ── Mock factories ────────────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, Partial<Record<string, jest.Mock>>> = {}) {
  const today = new Date();

  return {
    chat: {
      findMany: jest.fn().mockResolvedValue([
        { subject: 'Algebra', createdAt: today },
        { subject: 'Photosynthesis', createdAt: today },
        { subject: 'Algebra', createdAt: today }, // duplicate — should be deduped
      ]),
      findFirst: jest.fn().mockResolvedValue({ createdAt: today }),
      ...(overrides.chat ?? {}),
    },
    userTopicProgress: {
      findMany: jest.fn().mockResolvedValue([
        { topic: 'Algebra', masteryScore: 0.4, lastAttemptedAt: today },
      ]),
      ...(overrides.userTopicProgress ?? {}),
    },
    testResult: {
      findFirst: jest.fn().mockResolvedValue({ score: 55, createdAt: today }),
      count: jest.fn().mockResolvedValue(3),
      ...(overrides.testResult ?? {}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ grade: '10', board: 'CBSE' }),
      ...(overrides.user ?? {}),
    },
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildRecommendationContext', () => {
  it('should return correct context shape when all data exists', async () => {
    const prisma = makePrisma();
    const ctx = await buildRecommendationContext('user-1', prisma);

    expect(ctx.userId).toBe('user-1');
    expect(ctx.grade).toBe('10');
    expect(ctx.board).toBe('CBSE');
    expect(ctx.recentChatTopics).toEqual(['Algebra', 'Photosynthesis']);
    expect(ctx.weakTopics.length).toBe(1);
    expect(ctx.weakTopics[0].topic).toBe('Algebra');
    expect(ctx.lastTestScore).toBe(55);
    expect(ctx.totalTestsAttempted).toBe(3);
    expect(typeof ctx.daysSinceLastActivity).toBe('number');
  });

  it('should handle userId with no chats (recentChatTopics = [])', async () => {
    const prisma = makePrisma({
      chat: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });
    const ctx = await buildRecommendationContext('user-no-chats', prisma);

    expect(ctx.recentChatTopics).toEqual([]);
  });

  it('should handle userId with no test history (lastTestScore = undefined)', async () => {
    const prisma = makePrisma({
      testResult: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
    });
    const ctx = await buildRecommendationContext('user-no-tests', prisma);

    expect(ctx.lastTestScore).toBeUndefined();
    expect(ctx.totalTestsAttempted).toBe(0);
  });

  it('should return daysSinceLastActivity = 0 when activity was today', async () => {
    const today = new Date();
    const prisma = makePrisma({
      chat: {
        findMany: jest.fn().mockResolvedValue([{ subject: 'Math', createdAt: today }]),
        findFirst: jest.fn().mockResolvedValue({ createdAt: today }),
      },
      testResult: {
        findFirst: jest.fn().mockResolvedValue({ score: 80, createdAt: today }),
        count: jest.fn().mockResolvedValue(1),
      },
    });
    const ctx = await buildRecommendationContext('user-active-today', prisma);

    expect(ctx.daysSinceLastActivity).toBe(0);
  });
});
