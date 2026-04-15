/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/trial
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/trial.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | add trial API unit tests
 */

describe('POST /api/trial', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns 400 when phone missing or invalid', async () => {
    const { POST } = await import('@/app/api/trial/route')

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentName: 'Test Parent' }),
    })

    const res: any = await POST(req as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns existing active trial when one exists', async () => {
    const now = new Date()
    const existing = { id: 'trial-exists-1', expiresAt: new Date(now.getTime() + 1000 * 60 * 60) }

    jest.doMock('@/lib/prisma', () => ({ prisma: { trial: { findFirst: async () => existing } } }))

    const route = await import('@/app/api/trial/route')

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+911234567890' }),
    })

    const res: any = await route.POST(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.message).toBe('trial already active')
    expect(body.trialId).toBe(existing.id)
  })

  it('creates a new trial and emits analytics', async () => {
    const createMock = jest.fn().mockResolvedValue({ id: 'trial-new-1', expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) })
    const findFirstMock = jest.fn().mockResolvedValue(null)
    const analyticsCreateMock = jest.fn().mockResolvedValue({})

    jest.doMock('@/lib/prisma', () => ({ prisma: { trial: { findFirst: findFirstMock, create: createMock }, analyticsEvent: { create: analyticsCreateMock } } }))

    const route = await import('@/app/api/trial/route')

    const payload = { phone: '9876543210', parentName: 'Parent Name' }
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res: any = await route.POST(req as any)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.trialId).toBe('trial-new-1')
    expect(createMock).toHaveBeenCalled()
    expect(analyticsCreateMock).toHaveBeenCalled()
  })

})
