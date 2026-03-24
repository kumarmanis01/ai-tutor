import makePromotionService from '@/lib/promotion/service'

describe('Promotion service', () => {
  const prisma: any = {
    promotionCandidate: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn()
  }

  const svc = makePromotionService(prisma)

  beforeEach(() => jest.resetAllMocks())

  test('approveCandidate throws when candidate not found', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma))
    prisma.promotionCandidate.findUnique.mockResolvedValue(null)
    await expect(svc.approveCandidate('nope', 'admin')).rejects.toThrow('candidate not found')
  })

  test('approveCandidate throws when already approved or rejected', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma))
    prisma.promotionCandidate.findUnique.mockResolvedValue({ id: 'pc1', status: 'APPROVED' })
    await expect(svc.approveCandidate('pc1', 'admin')).rejects.toThrow('candidate already approved')
    prisma.promotionCandidate.findUnique.mockResolvedValue({ id: 'pc2', status: 'REJECTED' })
    await expect(svc.approveCandidate('pc2', 'admin')).rejects.toThrow('candidate already rejected')
  })

  test('approveCandidate updates candidate status to APPROVED', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma))
    const cand = { id: 'pc1', scope: 'LESSON', scopeRefId: 'l1', outputRef: 'o1', status: 'PENDING' }
    prisma.promotionCandidate.findUnique.mockResolvedValue(cand)
    prisma.promotionCandidate.update.mockResolvedValue({ id: 'pc1', status: 'APPROVED' })

    const approved = await svc.approveCandidate('pc1', 'admin', { note: 'ok' })
    expect(prisma.promotionCandidate.update).toHaveBeenCalledWith({ where: { id: 'pc1' }, data: expect.objectContaining({ status: 'APPROVED' }) })
    expect(approved.id).toBe('pc1')
  })

  test('rejectCandidate updates candidate and audits', async () => {
    prisma.promotionCandidate.findUnique.mockResolvedValue({ id: 'pc1', status: 'PENDING', scope: 'LESSON', scopeRefId: 'l1' })
    prisma.promotionCandidate.update.mockResolvedValue({ id: 'pc1', status: 'REJECTED' })
    const updated = await svc.rejectCandidate('pc1', 'admin', { note: 'no' })
    expect(prisma.promotionCandidate.update).toHaveBeenCalledWith({ where: { id: 'pc1' }, data: expect.objectContaining({ status: 'REJECTED' }) })
    expect(updated.status).toBe('REJECTED')
  })
})
