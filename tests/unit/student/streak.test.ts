/**
 * Unit tests for streak shield notification.
 * F-STU-030 AC-03: Student notified when shield auto-activates.
 *
 * Tests: lib/student/streak.ts (classifyStreakGap helper).
 * Note: updateStreak() requires DB + Redis; tested via classifyStreakGap (pure function).
 */

import { classifyStreakGap } from '@/lib/student/streak'

describe('classifyStreakGap', () => {
  it('should return same_day when last session is today', () => {
    const today = new Date()
    expect(classifyStreakGap(today, today)).toBe('same_day')
  })

  it('should return consecutive when last session was yesterday', () => {
    const today = new Date()
    const yesterday = new Date(today.getTime() - 86400000)
    expect(classifyStreakGap(yesterday, today)).toBe('consecutive')
  })

  it('should return broken when last session was 2 days ago', () => {
    const today = new Date()
    const twoDaysAgo = new Date(today.getTime() - 2 * 86400000)
    expect(classifyStreakGap(twoDaysAgo, today)).toBe('broken')
  })

  it('should return broken when lastSessionDate is null', () => {
    expect(classifyStreakGap(null, new Date())).toBe('broken')
  })

  it('should return broken when last session was 7 days ago', () => {
    const today = new Date()
    const week = new Date(today.getTime() - 7 * 86400000)
    expect(classifyStreakGap(week, today)).toBe('broken')
  })
})
