/**
 * FILE OBJECTIVE:
 * - Verify chat route handles missing legacy free-question column by using canonical freemium cap checks.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/chat/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-05T00:00:00Z | copilot | add P2022 fallback coverage for non-premium chat flow
 */

describe('chat route P2022 fallback', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns 403 when fallback freemium cap denies request after P2022', async () => {
    const p2022 = Object.assign(new Error('The column `User.todaysFreeQuestionsCount` does not exist in the current database.'), {
      code: 'P2022',
    })

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'student-1' } }) }))
    jest.doMock('@/lib/subscription', () => ({ isPremiumUser: async () => false }))
    jest.doMock('@/lib/freemium', () => ({
      checkFreeTierCap: async () => ({ allowed: false, sessionsUsed: 3, sessionsRemaining: 0, periodStart: new Date('2026-05-01T00:00:00.000Z') }),
      incrementFreeTierUsage: async () => undefined,
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        $transaction: async () => {
          throw p2022
        },
      },
    }))
    jest.doMock('@/lib/guardrails', () => ({ checkProfanity: () => false }))
    jest.doMock('@/utils/logApiUsage', () => ({ logApiUsage: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { debug: jest.fn(), error: jest.fn(), warn: jest.fn() } }))

    const { POST } = await import('@/app/api/chat/route')
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello tutor', subject: 'math' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('free_limit_reached')
  })
})
