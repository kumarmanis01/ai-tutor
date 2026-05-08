/**
 * FILE OBJECTIVE:
 * - Validate shared free-question quota consume/refund service behavior for column and fallback paths.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/freeQuestionQuota.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-08T00:00:00Z | copilot | add unit tests for shared free-question quota consume/refund service
 */

describe('freeQuestionQuota service', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('consumeDailyFreeQuestionQuota decrements column for free users', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'student-1', todaysFreeQuestionsCount: 5 }),
        update: jest.fn().mockResolvedValue({ todaysFreeQuestionsCount: 4 }),
      },
    }

    jest.doMock('@/lib/subscription', () => ({ isPremiumUser: async () => false }))
    jest.doMock('@/lib/freemium', () => ({ checkFreeTierCap: jest.fn(), incrementFreeTierUsage: jest.fn() }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        $transaction: async (cb: (arg: typeof tx) => Promise<unknown>) => cb(tx),
      },
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn() } }))

    const { consumeDailyFreeQuestionQuota } = await import('@/lib/freeQuestionQuota')
    const result = await consumeDailyFreeQuestionQuota('student-1')

    expect(result).toEqual({
      status: 'ok',
      isPremium: false,
      charged: true,
      remaining: 4,
      method: 'column',
    })
  })

  it('consumeDailyFreeQuestionQuota returns limit_reached when count is exhausted', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'student-2', todaysFreeQuestionsCount: 0 }),
        update: jest.fn(),
      },
    }

    jest.doMock('@/lib/subscription', () => ({ isPremiumUser: async () => false }))
    jest.doMock('@/lib/freemium', () => ({ checkFreeTierCap: jest.fn(), incrementFreeTierUsage: jest.fn() }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        $transaction: async (cb: (arg: typeof tx) => Promise<unknown>) => cb(tx),
      },
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn() } }))

    const { consumeDailyFreeQuestionQuota } = await import('@/lib/freeQuestionQuota')
    const result = await consumeDailyFreeQuestionQuota('student-2')

    expect(result).toEqual({ status: 'limit_reached' })
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it('refundDailyFreeQuestionQuota increments column for column method', async () => {
    const update = jest.fn().mockResolvedValue({})

    jest.doMock('@/lib/subscription', () => ({ isPremiumUser: async () => false }))
    jest.doMock('@/lib/freemium', () => ({ checkFreeTierCap: jest.fn(), incrementFreeTierUsage: jest.fn() }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { update },
      },
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn() } }))

    const { refundDailyFreeQuestionQuota } = await import('@/lib/freeQuestionQuota')
    await refundDailyFreeQuestionQuota('student-3', 'column')

    expect(update).toHaveBeenCalledWith({
      where: { id: 'student-3' },
      data: { todaysFreeQuestionsCount: { increment: 1 } },
    })
  })

  it('refundDailyFreeQuestionQuota decrements freemium usage for fallback method', async () => {
    const tx = {
      freeTierUsage: {
        findFirst: jest.fn().mockResolvedValue({ id: 'usage-1', sessionsUsed: 2 }),
        update: jest.fn().mockResolvedValue({}),
      },
    }

    jest.doMock('@/lib/subscription', () => ({ isPremiumUser: async () => false }))
    jest.doMock('@/lib/freemium', () => ({ checkFreeTierCap: jest.fn(), incrementFreeTierUsage: jest.fn() }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        $transaction: async (cb: (arg: typeof tx) => Promise<unknown>) => cb(tx),
      },
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn() } }))

    const { refundDailyFreeQuestionQuota } = await import('@/lib/freeQuestionQuota')
    await refundDailyFreeQuestionQuota('student-4', 'freemium')

    expect(tx.freeTierUsage.update).toHaveBeenCalledWith({
      where: { id: 'usage-1' },
      data: { sessionsUsed: 1 },
    })
  })
})
