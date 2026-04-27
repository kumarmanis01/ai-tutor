/**
 * FILE OBJECTIVE:
 * - Unit test ensuring `updateStreak` clears inactivity suppression keys for all linked parents
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/streak.suppression-reset.test.ts
 *
 * EDIT LOG:
 * - 2026-04-10T00:00:00Z | copilot | add suppression-reset test
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('updateStreak suppression-reset for multiple parents', () => {
  beforeEach(() => jest.resetModules())

  it('deletes inactivity suppression keys for all linked parents', async () => {
    const delMock = jest.fn().mockResolvedValue(3)
    const redisMock: any = { del: delMock }
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }))

    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

    const mockUser = { lastSessionDate: null, currentStreak: 0, longestStreak: 0 }
    const mockLinks = [{ parentId: 'parent1' }, { parentId: 'parent2' }, { parentId: 'parent3' }]

    const updateMock = jest.fn().mockResolvedValue({})
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: jest.fn().mockResolvedValue(mockUser), update: updateMock },
        parentStudent: { findMany: jest.fn().mockResolvedValue(mockLinks) },
      },
    }))

    const { updateStreak } = await import('../../../../lib/student/streak')
    await updateStreak('student-abc')

    expect(delMock).toHaveBeenCalled()
    const callArgs = delMock.mock.calls[0]
    // The implementation clears both legacy and unified suppression keys.
    // Assert that the legacy keys are present rather than strict equality.
    expect(callArgs).toEqual(expect.arrayContaining([
      'parent:inactivity:parent1:student-abc',
      'parent:inactivity:parent2:student-abc',
      'parent:inactivity:parent3:student-abc',
    ]))
  })
})
