/**
 * Integration tests for the /api/ask SSE streaming route.
 */

const mockPrisma: any = {
  conversation: { upsert: jest.fn() },
  chat: { create: jest.fn(), findMany: jest.fn() },
};
(global as any).__TEST_PRISMA__ = mockPrisma;

// Mock logApiUsage to prevent import side-effects
jest.mock('../../utils/logApiUsage', () => ({ logApiUsage: jest.fn().mockResolvedValue(undefined) }));

// Mock profanity guard
jest.mock('../../lib/guardrails', () => ({ checkProfanity: jest.fn().mockReturnValue(false) }));

// Stub OpenAI streaming
const mockStreamChunks = [
  { choices: [{ delta: { content: 'Hello' } }] },
  { choices: [{ delta: { content: ' world' } }] },
];

const mockOpenAICreate = jest.fn().mockResolvedValue(
  (async function* () {
    for (const chunk of mockStreamChunks) yield chunk;
  })(),
);

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
  }));
});

import { POST } from '../../app/api/ask/route';

describe('/api/ask SSE streaming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.conversation.upsert.mockResolvedValue({});
    mockPrisma.chat.create.mockResolvedValue({});
    mockPrisma.chat.findMany.mockResolvedValue([]);

    mockOpenAICreate.mockResolvedValue(
      (async function* () {
        for (const chunk of mockStreamChunks) yield chunk;
      })(),
    );
  });

  function makeRequest(body: object, sessionUserId = 'user-1') {
    (global as any).__TEST_SESSION__ = sessionUserId ? { user: { id: sessionUserId } } : null;
    return new Request('http://localhost/api/ask', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  test('should return text/event-stream content-type', async () => {
    const req = makeRequest({ text: 'What is photosynthesis?' });
    const res = await POST(req);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  test('should emit [DONE] on completion', async () => {
    const req = makeRequest({ text: 'Explain gravity' });
    const res = await POST(req);
    expect(res.body).not.toBeNull();

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }

    expect(text).toContain('data: [DONE]');
  });

  test('should return 401 when session missing', async () => {
    (global as any).__TEST_SESSION__ = null;
    const req = new Request('http://localhost/api/ask', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
