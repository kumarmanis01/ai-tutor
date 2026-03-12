import {
  LEVEL_THRESHOLDS,
  getLevelFromXP,
  getXPToNextLevel,
  getProgressPercent,
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
    test('99999 XP -> level 10 (capped)', () => {
      expect(getLevelFromXP(99999)).toBe(10)
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
    test('10000 XP (max level) -> null', () => {
      expect(getXPToNextLevel(10000)).toBeNull()
    })
    test('above max level -> null', () => {
      expect(getXPToNextLevel(15000)).toBeNull()
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
    test('10000 XP (max level) -> 100%', () => {
      expect(getProgressPercent(10000)).toBe(100)
    })
    test('100 XP (start of level 2) -> 0% in level 2 band', () => {
      expect(getProgressPercent(100)).toBe(0)
    })
    test('175 XP -> 50% in level 2 band (halfway 100->250)', () => {
      expect(getProgressPercent(175)).toBe(50)
    })
  })
})
