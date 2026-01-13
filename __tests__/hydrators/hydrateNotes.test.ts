import { hydrateNotes } from '../../hydrators/hydrateNotes'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    topicDef: { findUnique: jest.fn().mockResolvedValue(null) }
  }
}))

describe('hydrateNotes', () => {
  test('throws when topic missing', async () => {
    await expect(hydrateNotes('missing-topic', 'en' as any)).rejects.toThrow('Topic missing')
  })
})
