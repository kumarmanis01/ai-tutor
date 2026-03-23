import makePromotionService from '@/lib/promotion/service'

describe('Promotion invariants', () => {
  test('two candidates for same scope can both be approved sequentially', async () => {
    const prisma: any = {
      promotionCandidate: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({ id: 'pc', status: 'APPROVED' }) },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma))
    }

    const svc = makePromotionService(prisma)

    // First approval
    prisma.promotionCandidate.findUnique.mockResolvedValueOnce({ id: 'pc1', status: 'PENDING', scope: 'LESSON', scopeRefId: 'l1', outputRef: 'o1' })
    await svc.approveCandidate('pc1', 'admin')

    // Second approval (replacement)
    prisma.promotionCandidate.findUnique.mockResolvedValueOnce({ id: 'pc2', status: 'PENDING', scope: 'LESSON', scopeRefId: 'l1', outputRef: 'o2' })
    await svc.approveCandidate('pc2', 'admin')

    expect(prisma.promotionCandidate.update).toHaveBeenCalledTimes(2)
    expect(prisma.promotionCandidate.update).toHaveBeenNthCalledWith(1, { where: { id: 'pc1' }, data: expect.objectContaining({ status: 'APPROVED' }) })
    expect(prisma.promotionCandidate.update).toHaveBeenNthCalledWith(2, { where: { id: 'pc2' }, data: expect.objectContaining({ status: 'APPROVED' }) })
  })

  test('old RegenerationOutput records untouched (no updates)', async () => {
    const prisma: any = {
      promotionCandidate: { findUnique: jest.fn().mockResolvedValue({ id: 'pc1', status: 'PENDING', scope: 'LESSON', scopeRefId: 'l1', outputRef: 'o1' }), update: jest.fn() },
      regenerationOutput: { update: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma))
    }
    const svc = makePromotionService(prisma)
    await svc.approveCandidate('pc1', 'admin')
    // regenerationOutput.update should not have been called
    expect(prisma.regenerationOutput.update).not.toHaveBeenCalled()
  })
})
