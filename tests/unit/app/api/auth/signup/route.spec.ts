/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/auth/signup analytics emission and validation behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/auth/signup/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add student auth signup analytics coverage
 */

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('emits auth signup analytics on successful account creation', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'user-1', email: 'student@example.com', name: 'Student' }),
        update: jest.fn().mockResolvedValue({}),
      },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }))
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/email/templates', () => ({ welcomeEmailHtml: jest.fn().mockReturnValue('<p>welcome</p>') }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))

    const { POST } = await import('@/app/api/auth/signup/route')
    const res = await POST(new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'student@example.com', password: 'secret123', name: 'Student' }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    expect(res.status).toBe(200)
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'student.auth.signup', userId: 'user-1' }),
      'auth.signup',
    )
  })

  it('does not emit analytics when validation fails', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }))
    jest.doMock('bcryptjs', () => ({ hash: jest.fn() }))
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: jest.fn() }))
    jest.doMock('@/lib/email/templates', () => ({ welcomeEmailHtml: jest.fn() }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))

    const { POST } = await import('@/app/api/auth/signup/route')
    const res = await POST(new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'bad-email', password: '123' }),
      headers: { 'content-type': 'application/json' },
    }) as any)

    expect(res.status).toBe(400)
    expect(emitMock).not.toHaveBeenCalled()
  })
})
