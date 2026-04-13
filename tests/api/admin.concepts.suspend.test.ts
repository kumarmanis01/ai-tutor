/**
 * Integration tests for concept suspend/unsuspend endpoints and session start gate.
 * F-ADM-013 AC-04: Concept suspension on confirmed hallucination.
 */

const mockTransaction = jest.fn()
const mockConceptFindUnique = jest.fn()
const mockConceptUpdate = jest.fn()
const mockAuditCreate = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    concept: {
      findUnique: (...a: any[]) => mockConceptFindUnique(...a),
      update: (...a: any[]) => mockConceptUpdate(...a),
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

describe('POST /api/admin/concepts/[id]/suspend', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
  }

  test('suspends an active concept', async () => {
    mockConceptFindUnique.mockResolvedValue({ id: 'c1', name: 'Area of Circle', isSuspended: false })
    mockConceptUpdate.mockResolvedValue({})
    mockAuditCreate.mockResolvedValue({})

    const route = await import('@/app/api/admin/concepts/[id]/suspend/route')
    const res = await route.POST(makeRequest({ reason: 'hallucination confirmed' }), {
      params: Promise.resolve({ id: 'c1' }),
    } as any)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.conceptId).toBe('c1')
  })

  test('returns 403 for non-admin', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({
      user: { id: 'u1', role: 'student' },
    })
    const route = await import('@/app/api/admin/concepts/[id]/suspend/route')
    const res = await route.POST(makeRequest({ reason: 'x' }), {
      params: Promise.resolve({ id: 'c1' }),
    } as any)
    expect(res.status).toBe(403)
  })

  test('returns 400 when reason is empty', async () => {
    const route = await import('@/app/api/admin/concepts/[id]/suspend/route')
    const res = await route.POST(makeRequest({ reason: '' }), {
      params: Promise.resolve({ id: 'c1' }),
    } as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('reason_required')
  })

  test('returns 404 when concept not found', async () => {
    mockConceptFindUnique.mockResolvedValue(null)
    const route = await import('@/app/api/admin/concepts/[id]/suspend/route')
    const res = await route.POST(makeRequest({ reason: 'test' }), {
      params: Promise.resolve({ id: 'nope' }),
    } as any)
    expect(res.status).toBe(404)
  })

  test('returns 409 when concept already suspended', async () => {
    mockConceptFindUnique.mockResolvedValue({ id: 'c1', isSuspended: true })
    const route = await import('@/app/api/admin/concepts/[id]/suspend/route')
    const res = await route.POST(makeRequest({ reason: 'test' }), {
      params: Promise.resolve({ id: 'c1' }),
    } as any)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('already_suspended')
  })
})

describe('POST /api/admin/concepts/[id]/unsuspend', () => {
  function makeRequest(body: unknown) {
    return new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as any
  }

  test('lifts suspension on a suspended concept', async () => {
    mockConceptFindUnique.mockResolvedValue({ id: 'c1', name: 'Area', isSuspended: true })
    mockConceptUpdate.mockResolvedValue({})
    mockAuditCreate.mockResolvedValue({})

    const route = await import('@/app/api/admin/concepts/[id]/unsuspend/route')
    const res = await route.POST(makeRequest({ reason: 'chunk fixed' }), {
      params: Promise.resolve({ id: 'c1' }),
    } as any)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  test('returns 409 when concept is not suspended', async () => {
    mockConceptFindUnique.mockResolvedValue({ id: 'c1', isSuspended: false })
    const route = await import('@/app/api/admin/concepts/[id]/unsuspend/route')
    const res = await route.POST(makeRequest({ reason: 'x' }), {
      params: Promise.resolve({ id: 'c1' }),
    } as any)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('not_suspended')
  })

  test('returns 403 for non-admin', async () => {
    ;(getServerSessionForHandlers as jest.Mock).mockResolvedValue({
      user: { id: 'u1', role: 'student' },
    })
    const route = await import('@/app/api/admin/concepts/[id]/unsuspend/route')
    const res = await route.POST(makeRequest({ reason: 'x' }), {
      params: Promise.resolve({ id: 'c1' }),
    } as any)
    expect(res.status).toBe(403)
  })
})
