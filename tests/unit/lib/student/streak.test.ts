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
