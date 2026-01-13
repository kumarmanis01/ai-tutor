import makePromotionStore from '@/lib/promotion/store'

describe('Promotion store', () => {
  const prisma: any = {
    regenerationJob: { findUnique: jest.fn() },
    promotionCandidate: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  }

  const store = makePromotionStore(prisma)

  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('createPromotionCandidate throws if regeneration job not found', async () => {
    prisma.regenerationJob.findUnique.mockResolvedValue(null)
    await expect(store.createPromotionCandidate({ scope: 'LESSON', scopeRefId: 'l1', regenerationJobId: 'nope', outputRef: 'o1', createdBy: 'admin' })).rejects.toThrow('regeneration job not found')
  })

  test('createPromotionCandidate creates when job exists', async () => {
    prisma.regenerationJob.findUnique.mockResolvedValue({ id: 'j1' })
    prisma.promotionCandidate.create.mockResolvedValue({ id: 'pc1', scope: 'LESSON' })
    const created = await store.createPromotionCandidate({ scope: 'LESSON', scopeRefId: 'l1', regenerationJobId: 'j1', outputRef: 'o1', createdBy: 'admin' })
    expect(created.id).toBe('pc1')
    expect(prisma.promotionCandidate.create).toHaveBeenCalled()
  })

  test('listCandidatesByScope calls findMany', async () => {
    prisma.promotionCandidate.findMany.mockResolvedValue([])
    const list = await store.listCandidatesByScope('LESSON', 'l1')
    expect(prisma.promotionCandidate.findMany).toHaveBeenCalled()
    expect(Array.isArray(list)).toBe(true)
  })

  test('getCandidateById calls findUnique', async () => {
    prisma.promotionCandidate.findUnique.mockResolvedValue({ id: 'pc1' })
    const c = await store.getCandidateById('pc1')
    expect(prisma.promotionCandidate.findUnique).toHaveBeenCalledWith({ where: { id: 'pc1' } })
    expect(c).not.toBeNull()
    expect(c!.id).toBe('pc1')
  })
})
