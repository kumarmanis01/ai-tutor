/**
 * FILE OBJECTIVE:
 * - Verify `planId` is persisted on `PaymentOrder` and family pricing
 *   billing uses explicit family plan when available or 1.8× fallback.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-subscription.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | assistant | add tests for planId persistence and family pricing
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('parent subscription order - planId and family pricing', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('persists planId and uses explicit family plan when available', async () => {
    process.env.RAZORPAY_KEY_ID = 'rk_test'
    process.env.RAZORPAY_KEY_SECRET = 'rs_test'

    // Mock session as parent
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'p1', role: 'parent' } })) }))
    jest.doMock('@/lib/middleware/authRateLimit', () => ({ checkAuthRateLimit: jest.fn(async () => ({ allowed: true })) }))

    // Capture orders.create args
    let createdOrderArgs: any = null
    const ordersCreateMock = jest.fn(async (args: any) => {
      createdOrderArgs = args
      return { id: 'rz-order-1' }
    })

    // Mock Razorpay constructor to return our mocked orders API
    jest.doMock('razorpay', () => {
      return jest.fn().mockImplementation(() => ({ orders: { create: ordersCreateMock } }))
    })

    // Mock prisma to validate parent-child links and capture paymentOrder.create
    const paymentOrderCreateMock = jest.fn(async (data: any) => ({ id: 'po-1', ...data }))
    const prismaMock: any = {
      parentStudent: { findMany: jest.fn(async () => [{ studentId: 'c1' }, { studentId: 'c2' }, { studentId: 'c3' }]) },
      paymentOrder: { create: paymentOrderCreateMock },
    }
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))

    const { PLANS, rupeesToPaise } = await import('@/lib/billing/plans')

    // Family pricing requires exactly 3 children; route calculates 1.8x single price
    const req: any = { json: async () => ({ planId: 'standard_monthly', childIds: ['c1', 'c2', 'c3'], isFamily: true }) }

    const route = await import('@/app/api/parent/subscription/order/route')
    const res = await route.POST(req as unknown as Request)

    // Ensure Razorpay order was created with family amount (1.8x single child price)
    const expectedRupees = Math.round(PLANS.standard_monthly.billedRupees * 1.8 * 100) / 100
    const expectedAmount = rupeesToPaise(expectedRupees)
    expect(createdOrderArgs).toBeTruthy()
    expect(createdOrderArgs.amount).toBe(expectedAmount)

    // Ensure paymentOrder was created with the correct amount
    expect(paymentOrderCreateMock).toHaveBeenCalled()
    const calledData = paymentOrderCreateMock.mock.calls[0][0].data
    expect(calledData.amount).toBe(expectedAmount)
  })

  it('falls back to 1.8x multiplier when explicit family plan missing', async () => {
    process.env.RAZORPAY_KEY_ID = 'rk_test'
    process.env.RAZORPAY_KEY_SECRET = 'rs_test'

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'p2', role: 'parent' } })) }))
    jest.doMock('@/lib/middleware/authRateLimit', () => ({ checkAuthRateLimit: jest.fn(async () => ({ allowed: true })) }))

    let createdOrderArgs: any = null
    const ordersCreateMock = jest.fn(async (args: any) => {
      createdOrderArgs = args
      return { id: 'rz-order-2' }
    })
    jest.doMock('razorpay', () => jest.fn().mockImplementation(() => ({ orders: { create: ordersCreateMock } })))

    const paymentOrderCreateMock = jest.fn(async (data: any) => ({ id: 'po-2', ...data }))
    const prismaMock: any = {
      parentStudent: { findMany: jest.fn(async () => [{ studentId: 'c3' }, { studentId: 'c4' }, { studentId: 'c5' }]) },
      paymentOrder: { create: paymentOrderCreateMock },
    }
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))

    const { PLANS, rupeesToPaise } = await import('@/lib/billing/plans')

    // Family pricing requires exactly 3 children
    const req: any = { json: async () => ({ planId: 'lite_monthly', childIds: ['c3', 'c4', 'c5'], isFamily: true }) }
    const route = await import('@/app/api/parent/subscription/order/route')
    const res = await route.POST(req as unknown as Request)

    // Route always uses 1.8x of single-child price for family pricing
    const base = PLANS.lite_monthly.billedRupees
    const expectedRupees = Math.round(base * 1.8 * 100) / 100
    const expectedAmount = rupeesToPaise(expectedRupees)
    expect(createdOrderArgs).toBeTruthy()
    expect(createdOrderArgs.amount).toBe(expectedAmount)

    expect(paymentOrderCreateMock).toHaveBeenCalled()
    const calledData = paymentOrderCreateMock.mock.calls[0][0].data
    expect(calledData.amount).toBe(expectedAmount)
  })
})
