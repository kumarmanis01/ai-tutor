const mockPrisma: any = {
  coursePackage: { findFirst: jest.fn() },
  product: { findFirst: jest.fn(), findUnique: jest.fn() },
  purchase: { findFirst: jest.fn(), create: jest.fn() },
  enrollment: { create: jest.fn() },
  auditLog: { create: jest.fn() }
}
;(global as any).__TEST_PRISMA__ = mockPrisma

import * as enroll from '../../app/api/learn/enroll/route'
import * as storePurchase from '../../app/api/store/purchase/route'

describe('store + enroll gating', () => {
  afterEach(() => jest.resetAllMocks())

  test('enroll blocked when product exists and no purchase', async () => {
    ;(mockPrisma.coursePackage.findFirst as jest.Mock).mockResolvedValue({ id: 'pkg1' })
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue({ id: 'prod1', courseId: 'c1', active: true })
    ;(mockPrisma.purchase.findFirst as jest.Mock).mockResolvedValue(null)

    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ courseId: 'c1' }), headers: { 'Content-Type': 'application/json' } })
    const res = await enroll.POST(req as any)
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.error).toMatch(/Purchase required/)
  })

  test('enroll succeeds after purchase', async () => {
    ;(mockPrisma.coursePackage.findFirst as jest.Mock).mockResolvedValue({ id: 'pkg1' })
    ;(mockPrisma.product.findFirst as jest.Mock).mockResolvedValue({ id: 'prod1', courseId: 'c1', active: true })
    ;(mockPrisma.purchase.findFirst as jest.Mock).mockResolvedValue({ id: 'pu1' })
    ;(mockPrisma.enrollment.create as jest.Mock).mockResolvedValue({ id: 'e1' })

    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ courseId: 'c1' }), headers: { 'Content-Type': 'application/json' } })
    const res = await enroll.POST(req as any)
    const data = await res.json()
    expect(res.status).toBe(201)
    expect(data.ok).toBe(true)
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })

  test('purchase API creates purchase and then enrollment allowed', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue({ id: 'prod1', courseId: 'c1' })
    ;(mockPrisma.purchase.create as jest.Mock).mockResolvedValue({ id: 'pu1' })
    ;(mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'a1' })

    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ productId: 'prod1' }), headers: { 'Content-Type': 'application/json' } })
    const res = await storePurchase.POST(req as any)
    const data = await res.json()
    expect(res.status).toBe(201)
    expect(data.ok).toBe(true)
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })
})
