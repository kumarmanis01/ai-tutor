/**
 * Unit tests for RecommendationService.
 * All external dependencies (openai, ioredis, prisma) are mocked.
 */

import { RecommendationService } from '@/services/recommendationService';
import type { RecommendationContext } from '@/types/recommendation';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisDel = jest.fn();
const mockRedis = {
  get: mockRedisGet,
  set: mockRedisSet,
  del: mockRedisDel,
} as any;

const mockCreate = jest.fn().mockResolvedValue({
  choices: [
    {
      message: {
        content: JSON.stringify([
          {
            id: 'topic_review-algebra',
            type: 'topic_review',
            title: 'Review Algebra basics',
            prompt: 'Can you help me review key Algebra concepts?',
            reason: 'You scored 40% on Algebra last week.',
            relevanceScore: 0.9,
            topic: 'Algebra',
          },
          {
            id: 'practice_test-general',
            type: 'practice_test',
            title: 'Take a practice test',
            prompt: 'Give me 5 mixed difficulty questions.',
            reason: 'You have not tested yourself this week.',
            relevanceScore: 0.7,
          },
          {
            id: 'new_concept-physics',
            type: 'new_concept',
            title: 'Start Newton laws',
            prompt: 'Explain Newton first law of motion.',
            reason: 'Physics is next in your curriculum.',
            relevanceScore: 0.6,
          },
          {
            id: 'doubt_clearance-chemistry',
            type: 'doubt_clearance',
            title: 'Clear Chemistry doubt',
            prompt: 'Why does sodium react with water?',
            reason: 'You asked about reactions last session.',
            relevanceScore: 0.5,
          },
        ]),
      },
    },
  ],
});

const mockOpenAI = {
  chat: {
    completions: {
      create: mockCreate,
    },
  },
} as any;

const mockPrisma = {
  chat: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  userTopicProgress: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  testResult: {
    findFirst: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ grade: '10', board: 'CBSE' }),
  },
} as any;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeService() {
  return new RecommendationService(mockPrisma, mockRedis, mockOpenAI);
}

const CACHED_RESULT = {
  recommendations: [
    {
      id: 'topic_review-cached',
      type: 'topic_review',
      title: 'Cached result',
      prompt: 'Review from cache.',
      reason: 'Cached.',
      relevanceScore: 0.8,
    },
  ],
  context: { weakTopics: [], lastTestScore: undefined },
  cached: true,
  generatedAt: new Date().toISOString(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RecommendationService.getRecommendations', () => {
  it('should return cached result when Redis has a valid entry', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(CACHED_RESULT));

    const service = makeService();
    const result = await service.getRecommendations('user-1');

    expect(result.cached).toBe(true);
    expect(result.recommendations[0].id).toBe('topic_review-cached');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should call OpenAI when cache is empty, cache result, and return cached: false', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSet.mockResolvedValueOnce('OK');

    const service = makeService();
    const result = await service.getRecommendations('user-2');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.cached).toBe(false);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(mockRedisSet).toHaveBeenCalledWith(
      'reco:v1:user-2',
      expect.any(String),
      'EX',
      900
    );
    // Results sorted by relevanceScore descending
    const scores = result.recommendations.map((r) => r.relevanceScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it('should fall back to DEFAULT_RECOMMENDATIONS when OpenAI throws', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockCreate.mockRejectedValueOnce(new Error('OpenAI network error'));

    const service = makeService();
    const result = await service.getRecommendations('user-3');

    expect(result.cached).toBe(false);
    expect(result.recommendations.length).toBe(3);
    const types = result.recommendations.map((r) => r.type);
    expect(types).toContain('doubt_clearance');
    expect(types).toContain('practice_test');
    expect(types).toContain('new_concept');
  });

  it('should fall back to DEFAULT_RECOMMENDATIONS when OpenAI returns invalid JSON', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'this is not json at all' } }],
    });

    const service = makeService();
    const result = await service.getRecommendations('user-4');

    expect(result.cached).toBe(false);
    expect(result.recommendations.length).toBe(3);
  });
});

describe('RecommendationService.invalidateCache', () => {
  it('should delete the correct Redis key for the given userId', async () => {
    mockRedisDel.mockResolvedValueOnce(1);

    const service = makeService();
    await service.invalidateCache('user-5');

    expect(mockRedisDel).toHaveBeenCalledWith('reco:v1:user-5');
  });
});
