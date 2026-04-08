jest.mock('@/lib/prisma', () => ({
  prisma: { analyticsEvent: { create: jest.fn() } },
}))
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn() } }))
jest.mock('openai', () => {
  return function OpenAIMock() {
    return {
      embeddings: {
        create: jest.fn().mockResolvedValue({ data: [{ embedding: Array.from({ length: 1536 }, () => 0.1) }] }),
      },
    }
  }
})

import { getEmbedding, getEmbeddingsBatch } from '@/lib/ai/embeddings'
import { prisma } from '@/lib/prisma'

describe('embeddings analytics', () => {
  afterEach(() => jest.clearAllMocks())

  it('emits analyticsEvent for single embedding', async () => {
    const emb = await getEmbedding('hello world')
    expect(Array.isArray(emb)).toBe(true)
    expect(prisma.analyticsEvent.create).toHaveBeenCalled()
  })

  it('emits analyticsEvent for batch embeddings', async () => {
    const res = await getEmbeddingsBatch(['a', 'b', 'c'], 2)
    expect(res.length).toBe(3)
    expect(prisma.analyticsEvent.create).toHaveBeenCalled()
  })
})
