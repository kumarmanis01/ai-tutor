/**
 * FILE OBJECTIVE:
 * - Unit tests for computeDailyPlan, cacheDailyPlan, and getCachedDailyPlan.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial creation for S2-4 Daily Study Plan
 */

import { MasteryState } from '@prisma/client';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetProgressByState = jest.fn();
jest.mock('@/lib/mastery/topicProgress', () => ({
  getProgressByState: (...args: unknown[]) => mockGetProgressByState(...args),
}));

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisExpireat = jest.fn();
const mockGetRedis = jest.fn(() => ({
  get: mockRedisGet,
  set: mockRedisSet,
  expireat: mockRedisExpireat,
}));
jest.mock('@/lib/redis', () => ({ getRedis: () => mockGetRedis() }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { computeDailyPlan, cacheDailyPlan, getCachedDailyPlan } from '@/lib/studyPlan/dailyPlan';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTopicProgress(overrides: Partial<{
  topicSlug: string; subject: string; grade: string; board: string;
  state: MasteryState; score: number; lastStudiedAt: Date | null;
}> = {}) {
  return {
    id: 'tp-1',
    userId: 'user-1',
    topicSlug: 'quadratic-equations',
    subject: 'Mathematics',
    grade: '10',
    board: 'cbse',
    state: MasteryState.DEVELOPING,
    score: 0.6,
    attempts: 3,
    lastStudiedAt: new Date('2026-06-01T10:00:00Z'),
    masteredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeDailyPlan', () => {
  beforeEach(() => {
    mockGetProgressByState.mockReset();
  });

  it('should return up to 3 topics prioritising DEVELOPING over NOT_STARTED', async () => {
    const developing = [
      makeTopicProgress({ topicSlug: 'topic-a', state: MasteryState.DEVELOPING }),
      makeTopicProgress({ topicSlug: 'topic-b', state: MasteryState.DEVELOPING }),
    ];
    const notStarted = [
      makeTopicProgress({ topicSlug: 'topic-c', state: MasteryState.NOT_STARTED, score: 0 }),
    ];
    mockGetProgressByState
      .mockResolvedValueOnce(developing)
      .mockResolvedValueOnce(notStarted);

    const plan = await computeDailyPlan('user-1');

    expect(plan.topics).toHaveLength(3);
    expect(plan.topics[0].topicSlug).toBe('topic-a');
    expect(plan.topics[1].topicSlug).toBe('topic-b');
    expect(plan.topics[2].topicSlug).toBe('topic-c');
  });

  it('should cap plan at 3 topics even when more are available', async () => {
    const developing = [
      makeTopicProgress({ topicSlug: 'a' }),
      makeTopicProgress({ topicSlug: 'b' }),
      makeTopicProgress({ topicSlug: 'c' }),
      makeTopicProgress({ topicSlug: 'd' }),
    ];
    mockGetProgressByState
      .mockResolvedValueOnce(developing)
      .mockResolvedValueOnce([]);

    const plan = await computeDailyPlan('user-1');
    expect(plan.topics).toHaveLength(3);
  });

  it('should assign difficulty 3 when DEVELOPING score is below 0.40', async () => {
    const lowScore = makeTopicProgress({ topicSlug: 'hard-topic', score: 0.30 });
    mockGetProgressByState
      .mockResolvedValueOnce([lowScore])
      .mockResolvedValueOnce([]);

    const plan = await computeDailyPlan('user-1');
    expect(plan.topics[0].suggestedDifficulty).toBe(3);
  });

  it('should assign difficulty 5 when DEVELOPING score is at or above 0.40', async () => {
    const okScore = makeTopicProgress({ topicSlug: 'ok-topic', score: 0.50 });
    mockGetProgressByState
      .mockResolvedValueOnce([okScore])
      .mockResolvedValueOnce([]);

    const plan = await computeDailyPlan('user-1');
    expect(plan.topics[0].suggestedDifficulty).toBe(5);
  });

  it('should return an empty plan when no topics exist', async () => {
    mockGetProgressByState.mockResolvedValue([]);

    const plan = await computeDailyPlan('user-1');
    expect(plan.topics).toHaveLength(0);
  });
});

describe('cacheDailyPlan and getCachedDailyPlan', () => {
  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSet.mockReset();
    mockRedisExpireat.mockReset();
    mockGetRedis.mockReturnValue({
      get: mockRedisGet,
      set: mockRedisSet,
      expireat: mockRedisExpireat,
    });
  });

  it('should store the plan JSON and set expireat when caching', async () => {
    const plan = {
      topics: [],
      generatedAt: new Date('2026-06-09T10:00:00Z'),
    };
    mockRedisSet.mockResolvedValue('OK');
    mockRedisExpireat.mockResolvedValue(1);

    await cacheDailyPlan('user-1', plan);

    expect(mockRedisSet).toHaveBeenCalledTimes(1);
    const [key, value] = mockRedisSet.mock.calls[0];
    expect(key).toMatch(/^plan:user-1:/);
    expect(JSON.parse(value as string)).toMatchObject({ topics: [], generatedAt: expect.any(String) });
    expect(mockRedisExpireat).toHaveBeenCalledTimes(1);
  });

  it('should return null on cache miss', async () => {
    mockRedisGet.mockResolvedValue(null);
    const result = await getCachedDailyPlan('user-1');
    expect(result).toBeNull();
  });
});
