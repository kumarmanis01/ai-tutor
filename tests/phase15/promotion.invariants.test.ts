import makePromotionService from '@/lib/promotion/service'

describe('Promotion invariants', () => {
  test('only one PublishedOutput per scope and reversal by replacement', async () => {
    const calls: any[] = []
    const prisma: any = {
      promotionCandidate: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({ id: 'pc', status: 'APPROVED' }) },
      publishedOutput: { deleteMany: jest.fn().mockImplementation(async (q: any) => { calls.push({ op: 'deleteMany', where: q.where }); return { count: 1 } }), create: jest.fn().mockImplementation(async (data: any) => { calls.push({ op: 'create', data }); return { id: `pub-${calls.length}`, ...data } }) },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma))
    }

    const svc = makePromotionService(prisma)

    // First approval
    prisma.promotionCandidate.findUnique.mockResolvedValueOnce({ id: 'pc1', status: 'PENDING', scope: 'LESSON', scopeRefId: 'l1', outputRef: 'o1' })
    await svc.approveCandidate('pc1', 'admin')

    // Second approval (replacement)
    prisma.promotionCandidate.findUnique.mockResolvedValueOnce({ id: 'pc2', status: 'PENDING', scope: 'LESSON', scopeRefId: 'l1', outputRef: 'o2' })
    await svc.approveCandidate('pc2', 'admin')

    // Expect that deleteMany was called to remove previous PublishedOutput pointer
    const deleteCalls = calls.filter(c => c.op === 'deleteMany')
    const createCalls = calls.filter(c => c.op === 'create')
    expect(createCalls.length).toBe(2)
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1)
    // service calls publishedOutput.create({ data: { ... } }) so created call param is nested
    expect(createCalls[1].data.data.outputRef).toBe('o2')
  })

  test('old RegenerationOutput records untouched (no updates)', async () => {
    const prisma: any = {
      promotionCandidate: { findUnique: jest.fn().mockResolvedValue({ id: 'pc1', status: 'PENDING', scope: 'LESSON', scopeRefId: 'l1', outputRef: 'o1' }), update: jest.fn() },
      publishedOutput: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn().mockResolvedValue({ id: 'pub1' }) },
      regenerationOutput: { update: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma))
    }
    const svc = makePromotionService(prisma)
    await svc.approveCandidate('pc1', 'admin')
    // regenerationOutput.update should not have been called
    expect(prisma.regenerationOutput.update).not.toHaveBeenCalled()
  })
})
