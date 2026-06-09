/**
 * FILE OBJECTIVE:
 * - Integration tests for POST /api/concept/deep-dive: auth guard, daily limit SSE error,
 *   Redis cache key format, cache hit skips OpenAI, difficulty validation.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial tests for Deep Dive per-concept card (task S3-1)
 */

// ─── Mock setup (must happen before imports) ──────────────────────────────────

const mockGetDailyUsage = jest.fn<() => Promise<number>>().mockResolvedValue(0);
const mockGetDailyLimit = jest.fn<() => Promise<number>>().mockResolvedValue(50);
const mockIncrementDailyUsage = jest.fn<() => Promise<number>>().mockResolvedValue(1);

jest.mock('../../lib/credits/dailyCredits', () => ({
  getDailyUsage: (...args: unknown[]) => mockGetDailyUsage(...args),
  getDailyLimit: (...args: unknown[]) => mockGetDailyLimit(...args),
  incrementDailyUsage: (...args: unknown[]) => mockIncrementDailyUsage(...args),
}));

const mockRedisGet = jest.fn<() => Promise<string | null>>().mockResolvedValue(null);
const mockRedisSet = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockRedisInstance = { get: mockRedisGet, set: mockRedisSet };

jest.mock('../../lib/redis', () => ({
  getRedis: () => mockRedisInstance,
}));

const mockOpenAICreate = jest.fn().mockResolvedValue(
  (async function* () {
    yield { choices: [{ delta: { content: 'A deep explanation.' } }] };
    yield { choices: [{ delta: { content: ' More detail.' } }] };
  })(),
);

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
  })),
);

import { POST } from '../../app/api/concept/deep-dive/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: object, userId: string | null = 'user-1') {
  (global as any).__TEST_SESSION__ = userId ? { user: { id: userId } } : null;
  return new Request('http://localhost/api/concept/deep-dive', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_BODY = {
  topicSlug: 'plant-life',
  subject: 'biology',
  grade: '8',
  board: 'CBSE',
  conceptTitle: 'Photosynthesis',
  difficulty: 5,
};

async function drainStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/concept/deep-dive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDailyUsage.mockResolvedValue(0);
    mockGetDailyLimit.mockResolvedValue(50);
    mockRedisGet.mockResolvedValue(null);
    mockOpenAICreate.mockResolvedValue(
      (async function* () {
        yield { choices: [{ delta: { content: 'Explanation.' } }] };
      })(),
    );
  });

  it('should return 401 when unauthenticated', async () => {
    const req = makeRequest(VALID_BODY, null);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return SSE error when daily limit reached', async () => {
    mockGetDailyUsage.mockResolvedValue(50);
    mockGetDailyLimit.mockResolvedValue(50);
    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    const text = await drainStream(res);
    expect(text).toContain('daily_limit_reached');
    expect(text).toContain('[DONE]');
  });

  it('should use slugified conceptTitle in cache key', async () => {
    const bodyWithSpaces = { ...VALID_BODY, conceptTitle: 'Balanced Diet Plan' };
    const req = makeRequest(bodyWithSpaces);
    await POST(req);
    const cacheKeyArg = mockRedisGet.mock.calls[0]?.[0] as string;
    expect(cacheKeyArg).toContain('balanced-diet-plan');
    expect(cacheKeyArg).toMatch(/^deepdive:/);
  });

  it('should cache response after first generation', async () => {
    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    await drainStream(res);

    // Wait for fire-and-forget cache write (microtask queue)
    await new Promise((r) => setTimeout(r, 20));
    expect(mockRedisSet).toHaveBeenCalledWith(
      expect.stringMatching(/^deepdive:/),
      expect.any(String),
      'EX',
      expect.any(Number),
    );
  });

  it('should return cached content without OpenAI call on second request', async () => {
    mockRedisGet.mockResolvedValue('Cached deep dive content');
    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    const text = await drainStream(res);
    expect(text).toContain('"token"');
    expect(text).toContain('[DONE]');
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });

  it('should validate difficulty between 1 and 10 -- rejects 0', async () => {
    const req = makeRequest({ ...VALID_BODY, difficulty: 0 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should validate difficulty between 1 and 10 -- rejects 11', async () => {
    const req = makeRequest({ ...VALID_BODY, difficulty: 11 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 when conceptTitle is missing', async () => {
    const { conceptTitle: _, ...bodyWithout } = VALID_BODY;
    const req = makeRequest(bodyWithout);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should emit meta event with creditsUsed after streaming', async () => {
    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    const text = await drainStream(res);
    expect(text).toContain('"meta"');
    expect(text).toContain('creditsUsed');
  });

  it('should include difficulty in the cache key', async () => {
    const req = makeRequest({ ...VALID_BODY, difficulty: 9 });
    await POST(req);
    const cacheKeyArg = mockRedisGet.mock.calls[0]?.[0] as string;
    expect(cacheKeyArg).toMatch(/:9$/);
  });
});
