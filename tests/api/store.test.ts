const mockPrisma: any = {
  product: { findMany: jest.fn(), findUnique: jest.fn() },
  purchase: { create: jest.fn() },
  auditLog: { create: jest.fn() }
}
;(global as any).__TEST_PRISMA__ = mockPrisma

import * as products from '../../app/api/store/products/route'
import * as purchase from '../../app/api/store/purchase/route'

describe('store APIs', () => {
  afterEach(() => jest.resetAllMocks())

  test('GET /api/store/products returns products', async () => {
    ;(mockPrisma.product.findMany as jest.Mock).mockResolvedValue([{ id: 'p1', courseId: 'c1', priceCents: 100 }])
    ;(global as any).__TEST_SESSION__ = { user: { id: 'admin1' } }
    const res = await products.GET(new Request('http://localhost/?tenantId=t1') as any)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data[0].id).toBe('p1')
  })

  test('POST /api/store/purchase creates purchase', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', courseId: 'c1' })
    ;(mockPrisma.purchase.create as jest.Mock).mockResolvedValue({ id: 'pu1' })
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u1' } }
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ productId: 'p1' }), headers: { 'Content-Type': 'application/json' } })
    const res = await purchase.POST(req as any)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(mockPrisma.purchase.create).toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).toHaveBeenCalled()
  })

  test('cannot purchase product from another tenant', async () => {
    ;(mockPrisma.product.findUnique as jest.Mock).mockResolvedValue({ id: 'p2', courseId: 'c2', tenantId: 'tenantA' })
    ;(global as any).__TEST_SESSION__ = { user: { id: 'u2', tenantId: 'tenantB' } }
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ productId: 'p2' }), headers: { 'Content-Type': 'application/json' } })
    const res = await purchase.POST(req as any)
    expect(res.status).toBe(403)
  })
})
