/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/payments/create-order
 * - Covers: planId validation (valid, unknown, prototype-key, missing),
 *   own-property safety, and PaymentOrder.planId persistence.
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | staff-engineer | created in response to review comment
 */

import { PLANS } from '@/lib/billing/plans'

// ---------- shared mocks ----------
const mockSession = { user: { id: 'user-1' } }
const mockOrder = { orderId: 'order_abc', amount: 39900, currency: 'INR', planId: 'standard_monthly' as const }

function makePrismaCreate(capturedData: { planId?: unknown; planMonths?: unknown }[]) {
  return {
    paymentOrder: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        capturedData.push({ planId: data.planId, planMonths: data.planMonths })
        return Promise.resolve({ id: 'po-1' })
      }),
    },
  }
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
})

// ---------- helpers ----------
async function callRoute(body: unknown, capturedData: { planId?: unknown; planMonths?: unknown }[]) {
  jest.doMock('@/lib/session', () => ({
    getServerSessionForHandlers: jest.fn().mockResolvedValue(mockSession),
  }))
  jest.doMock('@/lib/payments/razorpay', () => ({
    createRazorpayOrder: jest.fn().mockResolvedValue(mockOrder),
  }))
  jest.doMock('@/lib/prisma', () => ({ prisma: makePrismaCreate(capturedData) }))
  jest.doMock('@/lib/payments/audit', () => ({ recordPaymentEvent: jest.fn().mockResolvedValue(undefined) }))
  jest.doMock('@/lib/logger', () => ({
    logger: { logAPI: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() },
  }))

  const { POST } = await import('@/app/api/payments/create-order/route')
  return POST(makeRequest(body) as unknown as Request)
}

// ---------- tests ----------

describe('POST /api/payments/create-order — planId validation', () => {
  it('should persist standard_monthly when valid planId is provided', async () => {
    const captured: { planId?: unknown; planMonths?: unknown }[] = []
    const res = await callRoute({ planId: 'standard_monthly' }, captured)

    expect(res.status).toBe(200)
    expect(captured[0]?.planId).toBe('standard_monthly')
    expect(captured[0]?.planMonths).toBe(PLANS.standard_monthly.durationMonths)
  })

  it('should persist family_monthly when family_monthly planId is provided', async () => {
    const captured: { planId?: unknown; planMonths?: unknown }[] = []
    const res = await callRoute({ planId: 'family_monthly' }, captured)

    expect(res.status).toBe(200)
    expect(captured[0]?.planId).toBe('family_monthly')
    expect(captured[0]?.planMonths).toBe(PLANS.family_monthly.durationMonths)
  })

  it('should default to standard_monthly when planId is unknown', async () => {
    const captured: { planId?: unknown; planMonths?: unknown }[] = []
    const res = await callRoute({ planId: 'definitely_not_a_plan' }, captured)

    expect(res.status).toBe(200)
    expect(captured[0]?.planId).toBe('standard_monthly')
  })

  it('should default to standard_monthly when planId is missing from body', async () => {
    const captured: { planId?: unknown; planMonths?: unknown }[] = []
    const res = await callRoute({}, captured)

    expect(res.status).toBe(200)
    expect(captured[0]?.planId).toBe('standard_monthly')
  })

  it('should default to standard_monthly when body is null', async () => {
    jest.resetModules()
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(mockSession),
    }))

    const capturedData: { planId?: unknown }[] = []
    jest.doMock('@/lib/prisma', () => ({ prisma: makePrismaCreate(capturedData) }))
    jest.doMock('@/lib/payments/razorpay', () => ({
      createRazorpayOrder: jest.fn().mockResolvedValue(mockOrder),
    }))
    jest.doMock('@/lib/payments/audit', () => ({ recordPaymentEvent: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/logger', () => ({
      logger: { logAPI: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() },
    }))

    const { POST } = await import('@/app/api/payments/create-order/route')
    // Send malformed body
    const req = new Request('http://localhost/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req as unknown as Request)

    expect(res.status).toBe(200)
    expect(capturedData[0]?.planId).toBe('standard_monthly')
  })

  it('should default to standard_monthly for prototype-key injection attempt (__proto__)', async () => {
    const captured: { planId?: unknown; planMonths?: unknown }[] = []
    const res = await callRoute({ planId: '__proto__' }, captured)

    expect(res.status).toBe(200)
    expect(captured[0]?.planId).toBe('standard_monthly')
  })

  it('should default to standard_monthly for prototype-key injection attempt (toString)', async () => {
    const captured: { planId?: unknown; planMonths?: unknown }[] = []
    const res = await callRoute({ planId: 'toString' }, captured)

    expect(res.status).toBe(200)
    expect(captured[0]?.planId).toBe('standard_monthly')
  })

  it('should return 401 when user is not authenticated', async () => {
    jest.resetModules()
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(null),
    }))
    jest.doMock('@/lib/logger', () => ({
      logger: { logAPI: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() },
    }))

    const { POST } = await import('@/app/api/payments/create-order/route')
    const res = await POST(makeRequest({ planId: 'standard_monthly' }) as unknown as Request)
    expect(res.status).toBe(401)
  })
})
