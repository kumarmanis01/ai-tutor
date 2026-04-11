/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'
import '../../helpers/mockSession'

describe('Parent payment-methods API', () => {
  beforeEach(() => {
    resetPrismaMock()
    ;(global as any).__TEST_SESSION__ = { user: { id: 'parent-1', role: 'parent', email: 'parent@example.test' } }
  })

  it('creates payment customer and method and returns 201', async () => {
    prismaMock.paymentCustomer.findUnique.mockResolvedValue(null)
    prismaMock.paymentCustomer.create.mockResolvedValue({ id: 'cust-1', userId: 'parent-1', provider: 'razorpay', providerCustomerId: 'rcust_123' })
    prismaMock.paymentMethod.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.paymentMethod.create.mockResolvedValue({ id: 'pm-1', userId: 'parent-1', provider: 'razorpay', providerPaymentMethodId: 'pm_123' })

    const { POST } = await import('@/app/api/parent/payment-methods/route')
    const payload = { provider: 'razorpay', providerCustomerId: 'rcust_123', providerPaymentMethodId: 'pm_123', type: 'card', last4: '4242', cardBrand: 'visa', expiryMonth: 12, expiryYear: 2030, isDefault: true }
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } })
    const res = await POST(req as any) as any
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe('pm-1')
    expect(prismaMock.paymentCustomer.create).toHaveBeenCalled()
    expect(prismaMock.paymentMethod.create).toHaveBeenCalled()
  })

  it('returns 400 when missing providerPaymentMethodId', async () => {
    const { POST } = await import('@/app/api/parent/payment-methods/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } })
    const res = await POST(req as any) as any
    expect(res.status).toBe(400)
  })
})
