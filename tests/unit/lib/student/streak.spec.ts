/**
 * FILE OBJECTIVE:
 * - Verifies streak updates persist the new state and emit canonical analytics.
 * - Covers same-day idempotency and the shield-protected gap path.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/streak.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | created streak analytics coverage
 */

import { jest } from '@jest/globals'

const prismaUserFindUnique = jest.fn()
const prismaUserUpdate = jest.fn()
const prismaParentStudentFindMany = jest.fn()
const isShieldAvailableMock = jest.fn()
const consumeShieldMock = jest.fn()
const emitServerAnalyticsEventMock = jest.fn().mockResolvedValue(undefined)
const sendPushSafeMock = jest.fn().mockResolvedValue(undefined)

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: prismaUserFindUnique,
      update: prismaUserUpdate,
    },
    parentStudent: {
      findMany: prismaParentStudentFindMany,
    },
  },
}))

jest.mock('@/lib/analytics/server', () => ({
  emitServerAnalyticsEvent: emitServerAnalyticsEventMock,
}))

jest.mock('@/lib/student/streakShield', () => ({
  isShieldAvailable: isShieldAvailableMock,
  consumeShield: consumeShieldMock,
}))

jest.mock('@/lib/push/send', () => ({
  sendPushSafe: sendPushSafeMock,
}))

jest.mock('@/lib/push/notifications', () => ({
  PUSH_NOTIFICATIONS: {
    streak_shield_used: jest.fn().mockReturnValue({ title: 'shield-used' }),
  },
}))

jest.mock('@/lib/engagement/timezone', () => ({
  getLocalDateString: jest.fn((date: Date) => date.toISOString().slice(0, 10)),
  startOfLocalDayUtc: jest.fn((value: string) => new Date(`${value}T00:00:00.000Z`)),
}))

jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn().mockReturnValue(null),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}))

describe('updateStreak', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prismaParentStudentFindMany.mockResolvedValue([])
    isShieldAvailableMock.mockResolvedValue(false)
  })

  test('should persist the incremented streak and emit analytics when the streak continues', async () => {
    prismaUserFindUnique.mockResolvedValue({
      lastSessionDate: new Date('2026-05-12T00:00:00.000Z'),
      currentStreak: 3,
      longestStreak: 5,
      timezone: null,
    })
    prismaUserUpdate.mockResolvedValue({})

    const { updateStreak } = await import('@/lib/student/streak')
    const result = await updateStreak('student-1')

    expect(result).toEqual({
      currentStreak: 4,
      longestStreak: 5,
      streakIncremented: true,
      shieldActivated: false,
    })
    expect(prismaUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'student-1' },
        data: expect.objectContaining({ currentStreak: 4, longestStreak: 5 }),
      }),
    )
    expect(emitServerAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'student.streak.updated',
        userId: 'student-1',
        metadata: expect.objectContaining({ currentStreak: 4, longestStreak: 5, streakIncremented: true, shieldActivated: false }),
      }),
      'student.streak.update',
    )
  })

  test('should return the current state and skip analytics when already counted today', async () => {
    prismaUserFindUnique.mockResolvedValue({
      lastSessionDate: new Date('2026-05-13T10:15:00.000Z'),
      currentStreak: 8,
      longestStreak: 10,
      timezone: null,
    })

    const { updateStreak } = await import('@/lib/student/streak')
    const result = await updateStreak('student-2')

    expect(result).toEqual({
      currentStreak: 8,
      longestStreak: 10,
      streakIncremented: false,
      shieldActivated: false,
    })
    expect(prismaUserUpdate).not.toHaveBeenCalled()
    expect(emitServerAnalyticsEventMock).not.toHaveBeenCalled()
  })
})
