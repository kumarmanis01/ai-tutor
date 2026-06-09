/**
 * FILE OBJECTIVE:
 * - Unit tests verifying that the generation cache key includes difficulty,
 *   producing different keys for different difficulty values.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial creation for difficulty parameter feature
 */

import { buildGenerationCacheKey } from '@/lib/cache/generationCache';

const BASE_KEY = {
  board: 'cbse',
  grade: '10',
  subject: 'Mathematics',
  topicSlug: 'quadratic-equations',
  contentType: 'explanation',
};

describe('buildGenerationCacheKey with difficulty', () => {
  it('should produce different cache keys for different difficulty values', () => {
    const keyLevel3 = buildGenerationCacheKey({ ...BASE_KEY, difficulty: '3' });
    const keyLevel7 = buildGenerationCacheKey({ ...BASE_KEY, difficulty: '7' });
    expect(keyLevel3).not.toBe(keyLevel7);
  });

  it('should produce same cache key for same difficulty regardless of call order', () => {
    const first = buildGenerationCacheKey({ ...BASE_KEY, difficulty: '5' });
    const second = buildGenerationCacheKey({ ...BASE_KEY, difficulty: '5' });
    expect(first).toBe(second);
  });
});
