jest.mock('@/lib/audit/log', () => ({ logAuditEvent: jest.fn() }))

import makePromotionStore from '@/lib/promotion/store'
import makePromotionService from '@/lib/promotion/service'
import { logAuditEvent } from '@/lib/audit/log'

describe('Promotion audit events', () => {
  beforeEach(() => jest.resetAllMocks())

  test('store.createPromotionCandidate emits audit event', async () => {
    const prisma: any = {
      regenerationJob: { findUnique: jest.fn().mockResolvedValue({ id: 'j1' }) },
      promotionCandidate: { create: jest.fn().mockResolvedValue({ id: 'pc1' }) }
    }
    const store = makePromotionStore(prisma)
    await store.createPromotionCandidate({ scope: 'LESSON', scopeRefId: 'l1', regenerationJobId: 'j1', outputRef: 'o1', createdBy: 'admin' })
    expect(logAuditEvent).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: null, details: expect.objectContaining({ legacyAction: 'PROMOTION_CANDIDATE_CREATED' }) }))
  })

  test('service.approveCandidate emits audit event', async () => {
    const prisma: any = {
      promotionCandidate: { findUnique: jest.fn().mockResolvedValue({ id: 'pc1', status: 'PENDING', scope: 'LESSON', scopeRefId: 'l1', outputRef: 'o1' }), update: jest.fn().mockResolvedValue({ id: 'pc1', status: 'APPROVED' }) },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma))
    }
    const svc = makePromotionService(prisma)
    await svc.approveCandidate('pc1', 'admin')
    expect(logAuditEvent).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: null, details: expect.objectContaining({ legacyAction: 'PROMOTION_APPROVED' }) }))
  })

  test('service.rejectCandidate emits audit event', async () => {
    const prisma: any = {
      promotionCandidate: { findUnique: jest.fn().mockResolvedValue({ id: 'pc1', status: 'PENDING', scope: 'LESSON', scopeRefId: 'l1' }), update: jest.fn().mockResolvedValue({ id: 'pc1', status: 'REJECTED' }) }
    }
    const svc = makePromotionService(prisma)
    await svc.rejectCandidate('pc1', 'admin')
    expect(logAuditEvent).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: null, details: expect.objectContaining({ legacyAction: 'PROMOTION_REJECTED' }) }))
  })
})
