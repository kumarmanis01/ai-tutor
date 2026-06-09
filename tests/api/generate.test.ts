/**
 * FILE OBJECTIVE:
 * - Integration tests for POST /api/generate: auth guard, daily limit SSE error,
 *   Redis cache hit (fake-stream), OpenAI model selection, cache key includes conceptTitle,
 *   and input validation for count range.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial tests for demand-pull generate flow (task S3)
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
    yield { choices: [{ delta: { content: 'Example 1.' } }] };
    yield { choices: [{ delta: { content: ' Done.' } }] };
  })(),
);

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
  })),
);

import { POST } from '../../app/api/generate/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: object, userId: string | null = 'user-1') {
  (global as any).__TEST_SESSION__ = userId ? { user: { id: userId } } : null;
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_BODY = {
  topicSlug: 'food-and-nutrition',
  subject: 'science',
  grade: '6',
  board: 'CBSE',
  contentType: 'examples',
  conceptTitle: null,
  count: 5,
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

describe('POST /api/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDailyUsage.mockResolvedValue(0);
    mockGetDailyLimit.mockResolvedValue(50);
    mockRedisGet.mockResolvedValue(null);
    mockOpenAICreate.mockResolvedValue(
      (async function* () {
        yield { choices: [{ delta: { content: 'Example 1.' } }] };
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

  it('should return cached content on Redis hit', async () => {
    mockRedisGet.mockResolvedValue('Cached example content');
    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    const text = await drainStream(res);
    expect(text).toContain('"token"');
    expect(text).toContain('[DONE]');
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });

  it('should use gpt-4o-mini model', async () => {
    const req = makeRequest(VALID_BODY);
    await POST(req);
    expect(mockOpenAICreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' }),
    );
  });

  it('should include conceptTitle in cache key', async () => {
    const bodyWithConcept = { ...VALID_BODY, conceptTitle: 'Balanced Diet' };
    const req = makeRequest(bodyWithConcept);
    await POST(req);
    const cacheKeyArg = mockRedisGet.mock.calls[0]?.[0] as string;
    expect(cacheKeyArg).toContain('balanced-diet');
  });

  it('should use "mixed" in cache key when conceptTitle is null', async () => {
    const req = makeRequest(VALID_BODY);
    await POST(req);
    const cacheKeyArg = mockRedisGet.mock.calls[0]?.[0] as string;
    expect(cacheKeyArg).toContain('mixed');
  });

  it('should validate count between 1 and 10 -- rejects 0', async () => {
    const req = makeRequest({ ...VALID_BODY, count: 0 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should validate count between 1 and 10 -- rejects 11', async () => {
    const req = makeRequest({ ...VALID_BODY, count: 11 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 when contentType is invalid', async () => {
    const req = makeRequest({ ...VALID_BODY, contentType: 'homework' });
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
});
