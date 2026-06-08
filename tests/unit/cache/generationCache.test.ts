/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/cache/generationCache -- Redis get/set/key-build logic.
 *
 * EDIT LOG:
 * - 2026-06-08T13:00:00Z | claude | initial tests for task S1-2
 */

const mockGet = jest.fn();
const mockSet = jest.fn();

jest.mock('@/lib/redis', () => ({
  getRedis: () => ({ get: mockGet, set: mockSet }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { buildGenerationCacheKey, getGeneratedContent, setGeneratedContent } from '@/lib/cache/generationCache';
import type { GenerationCacheKey } from '@/lib/cache/generationCache';

const baseKey: GenerationCacheKey = {
  board: 'CBSE',
  grade: '10',
  subject: 'Mathematics',
  topicSlug: 'quadratic-equations',
  contentType: 'explanation',
  difficulty: 'medium',
};

describe('buildGenerationCacheKey', () => {
  it('should build a lowercase colon-separated key', () => {
    const result = buildGenerationCacheKey(baseKey);
    expect(result).toBe('gen:cbse:10:mathematics:quadratic-equations:explanation:medium');
  });

  it('should slugify spaces and special characters', () => {
    const result = buildGenerationCacheKey({
      ...baseKey,
      subject: 'Social Science',
      topicSlug: 'World War II',
    });
    expect(result).toContain('social-science');
    expect(result).toContain('world-war-ii');
  });
});

describe('getGeneratedContent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return cached value when Redis has it', async () => {
    mockGet.mockResolvedValue('cached answer');
    const result = await getGeneratedContent(baseKey);
    expect(result).toBe('cached answer');
    expect(mockGet).toHaveBeenCalledWith('gen:cbse:10:mathematics:quadratic-equations:explanation:medium');
  });

  it('should return null when Redis returns null', async () => {
    mockGet.mockResolvedValue(null);
    const result = await getGeneratedContent(baseKey);
    expect(result).toBeNull();
  });

  it('should return null and log on Redis error', async () => {
    mockGet.mockRejectedValue(new Error('connection refused'));
    const result = await getGeneratedContent(baseKey);
    expect(result).toBeNull();
  });
});

describe('setGeneratedContent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should call redis.set with correct key, value and TTL', async () => {
    mockSet.mockResolvedValue('OK');
    await setGeneratedContent(baseKey, 'new answer');
    expect(mockSet).toHaveBeenCalledWith(
      'gen:cbse:10:mathematics:quadratic-equations:explanation:medium',
      'new answer',
      'EX',
      604800
    );
  });

  it('should swallow Redis errors without throwing', async () => {
    mockSet.mockRejectedValue(new Error('write failed'));
    await expect(setGeneratedContent(baseKey, 'value')).resolves.toBeUndefined();
  });
});
