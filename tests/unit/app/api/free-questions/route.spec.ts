/**
 * FILE OBJECTIVE:
 * - Verify free-questions route falls back to canonical freemium checks when legacy DB column is missing.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/free-questions/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-05T00:00:00Z | copilot | add P2022 fallback coverage for GET and POST handlers
 */

describe('free-questions route P2022 fallback', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('GET falls back to checkFreeTierCap when todaysFreeQuestionsCount column is missing', async () => {
    const p2022 = Object.assign(new Error('The column `User.todaysFreeQuestionsCount` does not exist in the current database.'), {
      code: 'P2022',
    })

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'student-1' } }) }))
    jest.doMock('@/lib/subscription', () => ({ isPremiumUser: async () => false }))
    jest.doMock('@/lib/freemium', () => ({
      checkFreeTierCap: async () => ({ allowed: true, sessionsUsed: 1, sessionsRemaining: 2, periodStart: new Date('2026-05-01T00:00:00.000Z') }),
      incrementFreeTierUsage: async () => undefined,
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: {
          findUnique: async () => {
            throw p2022
          },
        },
      },
    }))
    jest.doMock('@/utils/logApiUsage', () => ({ logApiUsage: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { error: jest.fn(), logAPI: jest.fn() } }))

    const { GET } = await import('@/app/api/free-questions/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.remaining).toBe(2)
    expect(body.isPremium).toBe(false)
  })

  it('POST falls back to checkFreeTierCap/incrementFreeTierUsage when legacy column is missing', async () => {
    const p2022 = Object.assign(new Error('The column `User.todaysFreeQuestionsCount` does not exist in the current database.'), {
      code: 'P2022',
    })

    const incrementFreeTierUsage = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => ({ user: { id: 'student-1' } }) }))
    jest.doMock('@/lib/subscription', () => ({ isPremiumUser: async () => false }))
    jest.doMock('@/lib/freemium', () => ({
      checkFreeTierCap: async () => ({ allowed: true, sessionsUsed: 0, sessionsRemaining: 3, periodStart: new Date('2026-05-01T00:00:00.000Z') }),
      incrementFreeTierUsage,
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        $transaction: async () => {
          throw p2022
        },
      },
    }))
    jest.doMock('@/utils/logApiUsage', () => ({ logApiUsage: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { error: jest.fn(), logAPI: jest.fn() } }))

    const { POST } = await import('@/app/api/free-questions/route')
    const req = new Request('http://localhost/api/free-questions', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.remaining).toBe(2)
    expect(incrementFreeTierUsage).toHaveBeenCalledWith('student-1')
  })
})
