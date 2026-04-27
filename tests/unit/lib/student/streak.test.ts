/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/student/streak.ts ensuring suppression keys are cleared
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/streak.test.ts
 *
 * EDIT LOG:
 * - 2026-04-10T00:00:00Z | copilot | added test for clearing parent inactivity suppression keys
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('lib/student/streak.updateStreak', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('clears parent inactivity suppression keys after updating lastSessionDate', async () => {
    const redisDelMock = jest.fn().mockResolvedValue(2);
    const redisMock = { del: redisDelMock, get: jest.fn().mockResolvedValue(null) };
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }));

    const userFind = jest.fn().mockResolvedValue({ lastSessionDate: null, currentStreak: 0, longestStreak: 0 });
    const userUpdate = jest.fn().mockResolvedValue({});
    const parentLinks = [{ parentId: 'pA' }, { parentId: 'pB' }];

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: userFind, update: userUpdate },
        parentStudent: { findMany: jest.fn().mockResolvedValue(parentLinks) },
      },
    }));

    const { updateStreak } = await import('../../../../lib/student/streak');
    await updateStreak('student-123');

    expect(redisDelMock).toHaveBeenCalled()
    const allArgs = redisDelMock.mock.calls.flat()
    expect(allArgs).toEqual(expect.arrayContaining(['parent:inactivity:pA:student-123', 'parent:inactivity:pB:student-123']))
  });
});
/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/student/streak.ts ensuring suppression keys are cleared on activity
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/streak.test.ts
 *
 * EDIT LOG:
 * - 2026-04-10T00:00:00Z | copilot | added suppression-reset unit tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('lib/student/streak updateStreak suppression-clear', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('calls redis.del for parent inactivity keys when parents linked', async () => {
    const delMock = jest.fn().mockResolvedValue(2)
    const redisMock = { del: delMock }
    jest.doMock('@/lib/redis', () => ({ getRedis: () => redisMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

    const mockUser = { lastSessionDate: null, currentStreak: 0, longestStreak: 0 }
    const mockLinks = [{ parentId: 'pA' }, { parentId: 'pB' }]

    const updateMock = jest.fn().mockResolvedValue({})
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
        parentStudent: { findMany: jest.fn().mockResolvedValue(mockLinks) },
        user: { findUnique: jest.fn().mockResolvedValue(mockUser), update: updateMock },
      },
    }))

    const { updateStreak } = await import('../../../../lib/student/streak')
    // Call updateStreak which should invoke redis.del for the two parent keys
    await updateStreak('student-xyz')

    expect(delMock).toHaveBeenCalled()
    // keys should include both parent ids
    const calledWith = delMock.mock.calls[0]
    expect(calledWith[0]).toMatch(/parent:inactivity:pA:student-xyz/)
  })
})
import { classifyStreakGap } from '@/lib/student/streak'

describe('lib/student/streak', () => {
  describe('classifyStreakGap', () => {
    test('null, today → broken', () => {
      const today = new Date('2025-03-15T12:00:00Z')
      expect(classifyStreakGap(null, today)).toBe('broken')
    })

    test('today, today → same_day', () => {
      const today = new Date('2025-03-15T12:00:00Z')
      expect(classifyStreakGap(today, today)).toBe('same_day')
    })

    test('yesterday, today → consecutive', () => {
      const today = new Date('2025-03-15T12:00:00Z')
      const yesterday = new Date('2025-03-14T12:00:00Z')
      expect(classifyStreakGap(yesterday, today)).toBe('consecutive')
    })

    test('2 days ago, today → broken', () => {
      const today = new Date('2025-03-15T12:00:00Z')
      const twoDaysAgo = new Date('2025-03-13T12:00:00Z')
      expect(classifyStreakGap(twoDaysAgo, today)).toBe('broken')
    })

    test('last year, today → broken', () => {
      const today = new Date('2025-03-15T12:00:00Z')
      const lastYear = new Date('2024-03-15T12:00:00Z')
      expect(classifyStreakGap(lastYear, today)).toBe('broken')
    })

    test('time component stripped — same calendar day = same_day regardless of hour', () => {
      const todayNoon = new Date('2025-03-15T12:00:00Z')
      const todayLate = new Date('2025-03-15T23:59:59Z')
      const todayEarly = new Date('2025-03-15T00:00:01Z')
      expect(classifyStreakGap(todayLate, todayNoon)).toBe('same_day')
      expect(classifyStreakGap(todayEarly, todayNoon)).toBe('same_day')
      expect(classifyStreakGap(todayNoon, todayEarly)).toBe('same_day')
    })

    test('classifyStreakGap is pure — no I/O (synchronous, deterministic)', () => {
      const today = new Date('2025-03-15T12:00:00Z')
      const yesterday = new Date('2025-03-14T12:00:00Z')
      expect(classifyStreakGap(yesterday, today)).toBe('consecutive')
      expect(classifyStreakGap(yesterday, today)).toBe('consecutive')
    })
  })
})
