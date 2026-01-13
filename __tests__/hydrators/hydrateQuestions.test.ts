import { hydrateQuestions } from '../../hydrators/hydrateQuestions'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    topicDef: { findUnique: jest.fn().mockResolvedValue(null) }
  }
}))

describe('hydrateQuestions', () => {
  test('throws when topic missing', async () => {
    await expect(hydrateQuestions('missing-topic', 'easy' as any, 'en' as any)).rejects.toThrow('Topic missing')
  })
})
