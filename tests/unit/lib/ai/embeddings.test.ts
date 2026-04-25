/**
 * FILE OBJECTIVE:
 * - Unit tests for embedding utilities: verifies analytics events are emitted and
 *   that cost_usd is computed correctly (not hardcoded to 0).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/embeddings.test.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-14T00:00:00Z | copilot | add cost_usd > 0 assertions after fix
 */

// Ensure embedding calls run in tests even when OPENAI_API_KEY isn't set in CI
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test';

jest.mock('@/lib/prisma', () => ({
  prisma: { analyticsEvent: { create: jest.fn() } },
}));
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('openai', () => {
  return function OpenAIMock() {
    return {
      embeddings: {
        create: jest
          .fn()
          .mockResolvedValue({ data: [{ embedding: Array.from({ length: 1536 }, () => 0.1) }] }),
      },
    };
  };
});

import { getEmbedding, getEmbeddingsBatch } from '@/lib/ai/embeddings';
import { prisma } from '@/lib/prisma';

/** text-embedding-3-small: $0.02 per 1M input tokens. */
const COST_PER_TOKEN = 0.02 / 1_000_000;

describe('embeddings analytics', () => {
  afterEach(() => jest.clearAllMocks());

  it('emits analyticsEvent for single embedding', async () => {
    const emb = await getEmbedding('hello world');
    expect(Array.isArray(emb)).toBe(true);
    expect(prisma.analyticsEvent.create).toHaveBeenCalled();
  });

  it('cost_usd is computed (not 0) for single embedding', async () => {
    await getEmbedding('hello world test input for cost check');
    const call = (prisma.analyticsEvent.create as jest.Mock).mock.calls[0][0];
    const metadata = call.data.metadata as Record<string, unknown>;
    expect(typeof metadata.cost_usd).toBe('number');
    expect(metadata.cost_usd as number).toBeGreaterThan(0);
    // Sanity: input "hello world test input for cost check" ~9 words ~37 chars
    // estimate = ceil(37/4) = 10 tokens -> cost = 10 * COST_PER_TOKEN
    const inputChars = 'hello world test input for cost check'.slice(0, 8000).length;
    const expectedTokens = Math.max(1, Math.ceil(inputChars / 4));
    expect(metadata.cost_usd as number).toBeCloseTo(expectedTokens * COST_PER_TOKEN, 15);
  });

  it('emits analyticsEvent for batch embeddings', async () => {
    const res = await getEmbeddingsBatch(['a', 'b', 'c'], 2);
    expect(res.length).toBe(3);
    expect(prisma.analyticsEvent.create).toHaveBeenCalled();
  });

  it('cost_usd is computed (not 0) for batch embeddings', async () => {
    const inputs = ['alpha beta', 'gamma delta epsilon'];
    await getEmbeddingsBatch(inputs, 20);
    const call = (prisma.analyticsEvent.create as jest.Mock).mock.calls[0][0];
    const metadata = call.data.metadata as Record<string, unknown>;
    expect(typeof metadata.cost_usd).toBe('number');
    expect(metadata.cost_usd as number).toBeGreaterThan(0);
    const totalChars = inputs.reduce((s, t) => s + t.slice(0, 8000).length, 0);
    const expectedTokens = Math.max(1, Math.ceil(totalChars / 4));
    expect(metadata.cost_usd as number).toBeCloseTo(expectedTokens * COST_PER_TOKEN, 15);
  });
});
