import { BADGE_DEFINITIONS } from '@/lib/student/badges'

// Pure-logic tests: verify badge definitions are correct and complete.
// checkSessionBadges() is DB-dependent and covered by integration tests.

describe('BADGE_DEFINITIONS', () => {
  test('should contain all 8 required badge types', () => {
    const keys = BADGE_DEFINITIONS.map((b) => b.key)
    expect(keys).toContain('streak_7')
    expect(keys).toContain('streak_14')
    expect(keys).toContain('streak_30')
    expect(keys).toContain('streak_60')
    expect(keys).toContain('streak_100')
    expect(keys).toContain('consistency')
    expect(keys).toContain('comeback')
    expect(keys).toContain('chapter_master')
  })

  test('every badge has non-empty key, name, description, and icon', () => {
    for (const badge of BADGE_DEFINITIONS) {
      expect(badge.key.length).toBeGreaterThan(0)
      expect(badge.name.length).toBeGreaterThan(0)
      expect(badge.description.length).toBeGreaterThan(0)
      expect(badge.icon.length).toBeGreaterThan(0)
    }
  })

  test('badge keys are unique', () => {
    const keys = BADGE_DEFINITIONS.map((b) => b.key)
    const unique = new Set(keys)
    expect(unique.size).toBe(keys.length)
  })

  test('streak milestone badges are ordered 7, 14, 30, 60, 100', () => {
    const streakBadges = BADGE_DEFINITIONS.filter((b) => b.key.startsWith('streak_'))
    const thresholds = streakBadges.map((b) => parseInt(b.key.replace('streak_', ''), 10))
    expect(thresholds).toEqual([7, 14, 30, 60, 100])
  })

  test('badge names do not contain "failed", "missed", "broke" (copy rules)', () => {
    const forbidden = ['failed', 'missed', 'broke']
    for (const badge of BADGE_DEFINITIONS) {
      for (const word of forbidden) {
        expect(badge.name.toLowerCase()).not.toContain(word)
        expect(badge.description.toLowerCase()).not.toContain(word)
      }
    }
  })
})
