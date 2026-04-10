/**
 * FILE OBJECTIVE:
 * - Unit-level flow test: runInactivityAlerts sets suppression key; updateStreak clears it.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/inactivity_reset_flow.test.ts
 *
 * EDIT LOG:
 * - 2026-04-10T00:00:00Z | copilot | created flow test for suppression set + reset
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('inactivity alert -> updateStreak suppression-reset flow', () => {
  beforeEach(() => jest.resetModules())

  it('sets suppression on send and clears it on activity', async () => {
    // Mock Redis
    const setMock = jest.fn().mockResolvedValue('OK')
    const delMock = jest.fn().mockResolvedValue(1)
    const redisMock: any = { set: setMock, del: delMock }
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }))

    // Mock prisma for runInactivityAlerts
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findMany: jest.fn().mockResolvedValue([{ id: 'stu1', name: 'Student One' }]) },
        parentStudent: {
          findMany: jest.fn().mockResolvedValue([
            {
              studentId: 'stu1',
              excludeFromParentReport: false,
              isPaused: false,
              parent: { id: 'p1', email: 'p@example.test', phone: null, name: 'Parent One', parentProfile: { digestOptOut: false, inactivityOptOut: false } },
            },
          ]),
        },
        learningPlanItem: { findFirst: jest.fn().mockResolvedValue({ id: 'planItem1', concept: { name: 'Algebra' } }) },
      },
    }))

    // Mock notification delivery
    const sendMock = jest.fn().mockResolvedValue({ sent: true })
    jest.doMock('@/lib/notifications/delivery', () => ({ sendParentMilestoneNotification: sendMock }))

    const { runInactivityAlerts } = await import('../../../worker/jobs/inactivityAlert')
    const sent = await runInactivityAlerts()
    expect(sent).toBeGreaterThanOrEqual(0)
    expect(setMock).toHaveBeenCalled()
    expect(sendMock).toHaveBeenCalled()

    // Now mock prisma for updateStreak to ensure it clears suppression
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: jest.fn().mockResolvedValue({ lastSessionDate: null, currentStreak: 0, longestStreak: 0 }), update: jest.fn().mockResolvedValue({}) },
        parentStudent: { findMany: jest.fn().mockResolvedValue([{ parentId: 'p1' }]) },
      },
    }))

    const { updateStreak } = await import('../../../lib/student/streak')
    await updateStreak('stu1')

    expect(delMock).toHaveBeenCalled()
    // Ensure deletion contains parent and student ids
    const calledWith = delMock.mock.calls[0]
    expect(calledWith[0]).toMatch(/parent:inactivity:p1:stu1/)
  })
})
