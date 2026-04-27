import { assembleTest } from '../../hydrators/assembleTest'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    generatedTest: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() }
  }
}))

describe('assembleTest', () => {
  test('runs without error when no drafts', async () => {
    await expect(assembleTest('topic-1')).resolves.not.toThrow()
  })
})
