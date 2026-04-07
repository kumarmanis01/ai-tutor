import {
  LEVEL_THRESHOLDS,
  getLevelFromXP,
  getXPToNextLevel,
  getProgressPercent,
  getLevelTierName,
  MAX_LEVEL,
} from '@/lib/student/xp'

describe('lib/student/xp', () => {
  describe('getLevelFromXP', () => {
    test('0 XP -> level 1', () => {
      expect(getLevelFromXP(0)).toBe(1)
    })
    test('99 XP -> level 1', () => {
      expect(getLevelFromXP(99)).toBe(1)
    })
    test('100 XP -> level 2', () => {
      expect(getLevelFromXP(100)).toBe(2)
    })
    test('10000 XP -> level 10', () => {
      expect(getLevelFromXP(10000)).toBe(10)
    })
    test('59500 XP -> level 100 (max)', () => {
      expect(getLevelFromXP(59500)).toBe(100)
    })
    test('999999 XP -> level 100 (capped at max)', () => {
      expect(getLevelFromXP(999999)).toBe(100)
    })
    test('MAX_LEVEL is 100', () => {
      expect(MAX_LEVEL).toBe(100)
    })
    test('level threshold boundaries (exact matches)', () => {
      expect(getLevelFromXP(LEVEL_THRESHOLDS[0])).toBe(1)  // 0
      expect(getLevelFromXP(LEVEL_THRESHOLDS[1])).toBe(2)  // 100
      expect(getLevelFromXP(LEVEL_THRESHOLDS[2])).toBe(3)  // 250
      expect(getLevelFromXP(LEVEL_THRESHOLDS[3])).toBe(4)  // 500
      expect(getLevelFromXP(LEVEL_THRESHOLDS[4])).toBe(5)  // 1000
      expect(getLevelFromXP(LEVEL_THRESHOLDS[5])).toBe(6)  // 2000
      expect(getLevelFromXP(LEVEL_THRESHOLDS[6])).toBe(7)  // 3500
      expect(getLevelFromXP(LEVEL_THRESHOLDS[7])).toBe(8)  // 5000
      expect(getLevelFromXP(LEVEL_THRESHOLDS[8])).toBe(9)  // 7500
      expect(getLevelFromXP(LEVEL_THRESHOLDS[9])).toBe(10) // 10000
    })
  })

  describe('getXPToNextLevel', () => {
    test('0 XP -> 100 to next level', () => {
      expect(getXPToNextLevel(0)).toBe(100)
    })
    test('59500 XP (level 100 / max) -> null', () => {
      expect(getXPToNextLevel(59500)).toBeNull()
    })
    test('above max level XP -> null', () => {
      expect(getXPToNextLevel(99999)).toBeNull()
    })
    test('10000 XP (level 10, not max) -> positive number', () => {
      const xpToNext = getXPToNextLevel(10000)
      expect(xpToNext).not.toBeNull()
      expect(xpToNext).toBeGreaterThan(0)
    })
    test('50 XP -> 50 to level 2', () => {
      expect(getXPToNextLevel(50)).toBe(50)
    })
    test('100 XP -> 150 to level 3', () => {
      expect(getXPToNextLevel(100)).toBe(150)
    })
  })

  describe('getProgressPercent', () => {
    test('0 XP -> 0%', () => {
      expect(getProgressPercent(0)).toBe(0)
    })
    test('50 XP -> 50% (halfway to level 2)', () => {
      expect(getProgressPercent(50)).toBe(50)
    })
    test('59500 XP (level 100 / max) -> 100%', () => {
      expect(getProgressPercent(59500)).toBe(100)
    })
    test('10000 XP (start of level 10 band) -> 0% in level 10 band', () => {
      expect(getProgressPercent(10000)).toBe(0)
    })
    test('100 XP (start of level 2) -> 0% in level 2 band', () => {
      expect(getProgressPercent(100)).toBe(0)
    })
    test('175 XP -> 50% in level 2 band (halfway 100->250)', () => {
      expect(getProgressPercent(175)).toBe(50)
    })
  })

  describe('getLevelTierName', () => {
    test('level 1 -> Learner', () => { expect(getLevelTierName(1)).toBe('Learner') })
    test('level 9 -> Learner', () => { expect(getLevelTierName(9)).toBe('Learner') })
    test('level 10 -> Explorer', () => { expect(getLevelTierName(10)).toBe('Explorer') })
    test('level 19 -> Explorer', () => { expect(getLevelTierName(19)).toBe('Explorer') })
    test('level 20 -> Practitioner', () => { expect(getLevelTierName(20)).toBe('Practitioner') })
    test('level 30 -> Scholar', () => { expect(getLevelTierName(30)).toBe('Scholar') })
    test('level 49 -> Scholar', () => { expect(getLevelTierName(49)).toBe('Scholar') })
    test('level 50 -> Expert', () => { expect(getLevelTierName(50)).toBe('Expert') })
    test('level 75 -> Master', () => { expect(getLevelTierName(75)).toBe('Master') })
    test('level 99 -> Master', () => { expect(getLevelTierName(99)).toBe('Master') })
    test('level 100 -> Legend', () => { expect(getLevelTierName(100)).toBe('Legend') })
  })

  describe('LEVEL_THRESHOLDS', () => {
    test('has exactly 100 entries', () => {
      expect(LEVEL_THRESHOLDS.length).toBe(100)
    })
    test('first entry is 0 (level 1)', () => {
      expect(LEVEL_THRESHOLDS[0]).toBe(0)
    })
    test('last entry is 59500 (level 100)', () => {
      expect(LEVEL_THRESHOLDS[99]).toBe(59500)
    })
    test('thresholds are strictly increasing', () => {
      for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
        expect(LEVEL_THRESHOLDS[i]).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1] as number)
      }
    })
  })
})
