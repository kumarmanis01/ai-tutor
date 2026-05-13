/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/parent/link-child analytics and linking behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/parent/link-child/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add parent linked analytics coverage for child invite consumption
 */

describe('POST /api/parent/link-child', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('emits parent linked analytics when an invite is consumed', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)
    const redisMock = {
      get: jest.fn().mockResolvedValue('student-1'),
      del: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
    }

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'parent-1' } }),
    }))
    jest.doMock('@/lib/redis', () => ({ getRedis: jest.fn().mockReturnValue(redisMock) }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        parentStudent: {
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue({ id: 'link-1' }),
        },
        user: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({ role: 'user', email: 'parent@example.com', phone: null, name: 'Parent' })
            .mockResolvedValueOnce({ name: 'Student One' }),
          update: jest.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
        },
      },
    }))
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/sms', () => ({ sendSms: jest.fn().mockResolvedValue(undefined) }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }))

    const { POST } = await import('@/app/api/parent/link-child/route')
    const res = await POST(new Request('http://localhost/api/parent/link-child', {
      method: 'POST',
      body: JSON.stringify({ inviteToken: 'invite-1' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(res.status).toBe(200)
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'parent.linked',
        userId: 'parent-1',
        metadata: expect.objectContaining({ parentId: 'parent-1', studentId: 'student-1' }),
      }),
      'parent.link-child',
    )
  })

  it('does not emit analytics when the invite token is missing', async () => {
    const emitMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({ user: { id: 'parent-1' } }),
    }))
    jest.doMock('@/lib/redis', () => ({ getRedis: jest.fn().mockReturnValue({ get: jest.fn(), del: jest.fn(), set: jest.fn() }) }))
    jest.doMock('@/lib/prisma', () => ({ prisma: { parentStudent: { findUnique: jest.fn(), count: jest.fn(), create: jest.fn() }, user: { findUnique: jest.fn(), update: jest.fn() }, auditLog: { create: jest.fn() } } }))
    jest.doMock('@/lib/mailer', () => ({ sendMailSafe: jest.fn() }))
    jest.doMock('@/lib/sms', () => ({ sendSms: jest.fn() }))
    jest.doMock('@/lib/analytics/server', () => ({ emitServerAnalyticsEvent: emitMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }))

    const { POST } = await import('@/app/api/parent/link-child/route')
    const res = await POST(new Request('http://localhost/api/parent/link-child', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    }))

    expect(res.status).toBe(400)
    expect(emitMock).not.toHaveBeenCalled()
  })
})
