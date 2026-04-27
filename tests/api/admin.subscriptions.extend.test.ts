/**
 * Integration tests for POST /api/admin/subscriptions/[id]/extend
 * F-ADM-021 AC-01: Admin manual subscription extension.
 */

const mockTransaction = jest.fn()
const mockSubFindUnique = jest.fn()
const mockSubUpdate = jest.fn()
const mockAuditCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: (...a: any[]) => mockSubFindUnique(...a),
      update: (...a: any[]) => mockSubUpdate(...a),
    },
    auditLog: { create: (...a: any[]) => mockAuditCreate(...a) },
    $transaction: (...a: any[]) => mockTransaction(...a),
  },
}))

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}))

const { getServerSessionForHandlers } = require('@/lib/session')

beforeEach(() => {
  jest.resetAllMocks()
  ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({
    user: { id: 'admin1', role: 'admin' },
  })
  mockTransaction.mockImplementation(async (ops: any[]) => Promise.all(ops))
})

describe('POST /api/admin/subscriptions/[id]/extend', () => {
  const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  function makeRequest(body: unknown) {
    return new Request('http://localhost/api/admin/subscriptions/sub1/extend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
  }

  test('extends endDate by requested days and returns new date', async () => {
    mockSubFindUnique.mockResolvedValue({ id: 'sub1', endDate: FUTURE, active: true })
    mockSubUpdate.mockResolvedValue({})
    mockAuditCreate.mockResolvedValue({})

    const route = await import('@/app/api/admin/subscriptions/[id]/extend/route')
    const res = await route.POST(makeRequest({ days: 7, reason: 'goodwill' }), {
      params: Promise.resolve({ id: 'sub1' }),
    } as any)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.newEndDate).toBeDefined()
    const newEnd = new Date(body.newEndDate)
    const expectedEnd = new Date(FUTURE)
    expectedEnd.setDate(expectedEnd.getDate() + 7)
    expect(newEnd.toDateString()).toBe(expectedEnd.toDateString())
  })

  test('returns 403 for non-admin', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({
      user: { id: 'u1', role: 'student' },
    })
    const route = await import('@/app/api/admin/subscriptions/[id]/extend/route')
    const res = await route.POST(makeRequest({ days: 7, reason: 'x' }), {
      params: Promise.resolve({ id: 'sub1' }),
    } as any)
    expect(res.status).toBe(403)
  })

  test('returns 400 when days is missing', async () => {
    const route = await import('@/app/api/admin/subscriptions/[id]/extend/route')
    const res = await route.POST(makeRequest({ reason: 'x' }), {
      params: Promise.resolve({ id: 'sub1' }),
    } as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('days_required')
  })

  test('returns 400 when days > 365', async () => {
    const route = await import('@/app/api/admin/subscriptions/[id]/extend/route')
    const res = await route.POST(makeRequest({ days: 400, reason: 'x' }), {
      params: Promise.resolve({ id: 'sub1' }),
    } as any)
    expect(res.status).toBe(400)
  })

  test('returns 400 when reason is empty', async () => {
    const route = await import('@/app/api/admin/subscriptions/[id]/extend/route')
    const res = await route.POST(makeRequest({ days: 7, reason: '' }), {
      params: Promise.resolve({ id: 'sub1' }),
    } as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('reason_required')
  })

  test('returns 404 when subscription not found', async () => {
    mockSubFindUnique.mockResolvedValue(null)
    const route = await import('@/app/api/admin/subscriptions/[id]/extend/route')
    const res = await route.POST(makeRequest({ days: 7, reason: 'test' }), {
      params: Promise.resolve({ id: 'nonexistent' }),
    } as any)
    expect(res.status).toBe(404)
  })

  test('writes audit log with SUBSCRIPTION_EXTEND action', async () => {
    mockSubFindUnique.mockResolvedValue({ id: 'sub1', endDate: FUTURE, active: true })
    mockSubUpdate.mockResolvedValue({})
    mockAuditCreate.mockResolvedValue({})

    const route = await import('@/app/api/admin/subscriptions/[id]/extend/route')
    await route.POST(makeRequest({ days: 14, reason: 'technical issue' }), {
      params: Promise.resolve({ id: 'sub1' }),
    } as any)

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    // Transaction args: [update, auditCreate]
    const [ops] = mockTransaction.mock.calls[0]
    expect(ops).toHaveLength(2)
  })
})
