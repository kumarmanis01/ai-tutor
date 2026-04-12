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
    test('10000 XP -> level 10 (capped)', () => {
      expect(getLevelFromXP(10000)).toBe(10)
    })
    test('Large XP -> capped at MAX_LEVEL', () => {
      expect(getLevelFromXP(59500)).toBe(MAX_LEVEL)
      expect(getLevelFromXP(999999)).toBe(MAX_LEVEL)
    })
    test('MAX_LEVEL is 10', () => {
      expect(MAX_LEVEL).toBe(10)
    })
    test('level threshold boundaries (exact matches)', () => {
      expect(getLevelFromXP(LEVEL_THRESHOLDS[0])).toBe(1)  // 0
      expect(getLevelFromXP(LEVEL_THRESHOLDS[1])).toBe(2)  // 100
      expect(getLevelFromXP(LEVEL_THRESHOLDS[2])).toBe(3)  // 300
      expect(getLevelFromXP(LEVEL_THRESHOLDS[3])).toBe(4)  // 600
      expect(getLevelFromXP(LEVEL_THRESHOLDS[4])).toBe(5)  // 1000
      expect(getLevelFromXP(LEVEL_THRESHOLDS[5])).toBe(6)  // 1600
      expect(getLevelFromXP(LEVEL_THRESHOLDS[6])).toBe(7)  // 2200
      expect(getLevelFromXP(LEVEL_THRESHOLDS[7])).toBe(8)  // 3000
      expect(getLevelFromXP(LEVEL_THRESHOLDS[8])).toBe(9)  // 4200
      expect(getLevelFromXP(LEVEL_THRESHOLDS[9])).toBe(10) // 6000
    })
  })

  describe('getXPToNextLevel', () => {
    test('0 XP -> 100 to next level', () => {
      expect(getXPToNextLevel(0)).toBe(100)
    })
    test('XP at or above MAX_LEVEL -> null', () => {
      expect(getXPToNextLevel(59500)).toBeNull()
      expect(getXPToNextLevel(99999)).toBeNull()
    })
    test('mid-level XP -> positive number to next level', () => {
      const xpToNext = getXPToNextLevel(1500) // between L5(1000) and L6(1600)
      expect(xpToNext).not.toBeNull()
      expect(xpToNext).toBeGreaterThan(0)
    })
    test('50 XP -> 50 to level 2', () => {
      expect(getXPToNextLevel(50)).toBe(50)
    })
    test('100 XP -> 200 to level 3', () => {
      expect(getXPToNextLevel(100)).toBe(200)
    })
  })

  describe('getProgressPercent', () => {
    test('0 XP -> 0%', () => {
      expect(getProgressPercent(0)).toBe(0)
    })
    test('50 XP -> 50% (halfway to level 2)', () => {
      expect(getProgressPercent(50)).toBe(50)
    })
    test('59500 XP (level >= max) -> 100%', () => {
      expect(getProgressPercent(59500)).toBe(100)
    })
    test('10000 XP (above max) -> 100% (capped)', () => {
      expect(getProgressPercent(10000)).toBe(100)
    })
    test('100 XP (start of level 2) -> 0% in level 2 band', () => {
      expect(getProgressPercent(100)).toBe(0)
    })
    test('200 XP -> 50% in level 2 band (halfway 100->300)', () => {
      expect(getProgressPercent(200)).toBe(50)
    })
  })

  describe('getLevelTierName', () => {
    test('level 1 -> Learner', () => { expect(getLevelTierName(1)).toBe('Learner') })
    test('level 3 -> Explorer', () => { expect(getLevelTierName(3)).toBe('Explorer') })
    test('level 5 -> Practitioner', () => { expect(getLevelTierName(5)).toBe('Practitioner') })
    test('level 7 -> Scholar', () => { expect(getLevelTierName(7)).toBe('Scholar') })
    test('level 9 -> Expert', () => { expect(getLevelTierName(9)).toBe('Expert') })
    test('level 10 -> Legend', () => { expect(getLevelTierName(10)).toBe('Legend') })
  })

  describe('LEVEL_THRESHOLDS', () => {
    test('has exactly 10 entries', () => {
      expect(LEVEL_THRESHOLDS.length).toBe(10)
    })
    test('first entry is 0 (level 1)', () => {
      expect(LEVEL_THRESHOLDS[0]).toBe(0)
    })
    test('last entry is the L10 threshold', () => {
      expect(LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]).toBeGreaterThan(0)
    })
    test('thresholds are strictly increasing', () => {
      for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
        expect(LEVEL_THRESHOLDS[i]).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1] as number)
      }
    })
  })
})
