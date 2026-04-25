import {
  getCachedExplanation,
  setCachedExplanation,
  invalidateExplanation,
  _explanationCacheInternals,
  type CachedExplanation,
} from '@/lib/ai/tutor/explanationCache';

const mockRedis = {
  get: jest.fn<Promise<string | null>, [string]>(),
  setex: jest.fn<Promise<'OK'>, [string, number, string]>(),
  del: jest.fn<Promise<number>, [string]>(),
};

jest.mock('@/lib/redis', () => ({
  getRedis: () => mockRedis,
}));

beforeEach(() => {
  mockRedis.get.mockReset();
  mockRedis.setex.mockReset();
  mockRedis.del.mockReset();
});

describe('explanationCache', () => {
  test('getCachedExplanation returns null on Redis miss', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    const res = await getCachedExplanation('c1', 'en', 'text');
    expect(res).toBeNull();
  });

  test('getCachedExplanation returns parsed CachedExplanation on hit', async () => {
    const payload: CachedExplanation = {
      conceptId: 'c1',
      lang: 'en',
      modality: 'text',
      content: 'hello',
      cachedAt: new Date().toISOString(),
    };
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(payload));
    const res = await getCachedExplanation('c1', 'en', 'text');
    expect(res).not.toBeNull();
    expect(res?.conceptId).toBe('c1');
    expect(res?.content).toBe('hello');
    expect(res?.cachedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('setCachedExplanation writes correct key + TTL 604800', async () => {
    mockRedis.setex.mockResolvedValueOnce('OK');
    await setCachedExplanation('conceptX', 'hi', 'worked_example', 'content');
    expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    const [key, ttl, json] = mockRedis.setex.mock.calls[0];
    expect(key).toBe('cache:exp:conceptX:hi:worked_example');
    expect(ttl).toBe(604800);
    const parsed = JSON.parse(json) as CachedExplanation;
    expect(parsed.content).toBe('content');
    expect(typeof parsed.cachedAt).toBe('string');
    expect(new Date(parsed.cachedAt).toISOString()).toBe(parsed.cachedAt);
  });

  test('Key format exactly: cache:exp:{conceptId}:{lang}:{modality}', () => {
    expect(_explanationCacheInternals.buildKey('c', 'en', 'text')).toBe('cache:exp:c:en:text');
  });

  test('getCachedExplanation returns null on Redis error (never throws)', async () => {
    mockRedis.get.mockRejectedValueOnce(new Error('redis down'));
    await expect(getCachedExplanation('c1', 'en', 'text')).resolves.toBeNull();
  });

  test('setCachedExplanation silently no-ops on Redis error (never throws)', async () => {
    mockRedis.setex.mockRejectedValueOnce(new Error('redis down'));
    await expect(setCachedExplanation('c1', 'en', 'text', 'x')).resolves.toBeUndefined();
  });

  test('invalidateExplanation deletes correct key', async () => {
    mockRedis.del.mockResolvedValueOnce(1);
    await invalidateExplanation('c9', 'en', 'analogy');
    expect(mockRedis.del).toHaveBeenCalledWith('cache:exp:c9:en:analogy');
  });

  test('invalidateExplanation never throws on Redis error', async () => {
    mockRedis.del.mockRejectedValueOnce(new Error('redis down'));
    await expect(invalidateExplanation('c9', 'en', 'analogy')).resolves.toBeUndefined();
  });

  test('cachedAt is a valid ISO datetime string on set', async () => {
    mockRedis.setex.mockResolvedValueOnce('OK');
    await setCachedExplanation('c1', 'en', 'text', 'y');
    const [, , json] = mockRedis.setex.mock.calls[0];
    const parsed = JSON.parse(json) as CachedExplanation;
    expect(parsed.cachedAt).toBe(new Date(parsed.cachedAt).toISOString());
  });
});
