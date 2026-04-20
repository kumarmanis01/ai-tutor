import {
  LEVEL_THRESHOLDS,
  getLevelFromXP,
  getXPToNextLevel,
  getProgressPercent,
  getLevelTierName,
  getTierColor,
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
    test('10000 XP -> reasonable mid-level (>=10)', () => {
      expect(getLevelFromXP(10000)).toBeGreaterThanOrEqual(10)
    })
    test('Large XP -> capped at MAX_LEVEL', () => {
      expect(getLevelFromXP(999999)).toBe(MAX_LEVEL)
    })
    test('MAX_LEVEL is 100', () => {
      expect(MAX_LEVEL).toBe(100)
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
      expect(getXPToNextLevel(999999)).toBeNull()
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
    test('Very large XP -> 100%', () => {
      expect(getProgressPercent(999999)).toBe(100)
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
    test('level 10 -> Bronze', () => { expect(getLevelTierName(10)).toBe('Bronze') })
    test('level 20 -> Silver', () => { expect(getLevelTierName(20)).toBe('Silver') })
    test('level 30 -> Gold', () => { expect(getLevelTierName(30)).toBe('Gold') })
    test('level 50 -> Platinum', () => { expect(getLevelTierName(50)).toBe('Platinum') })
    test('level 75 -> Diamond', () => { expect(getLevelTierName(75)).toBe('Diamond') })
    test('level 100 -> Legend', () => { expect(getLevelTierName(100)).toBe('Legend') })
  })

  describe('getTierColor', () => {
    test('level 1 -> gray (#9CA3AF)', () => { expect(getTierColor(1)).toBe('#9CA3AF') })
    test('level 3 -> blue (#3B82F6)', () => { expect(getTierColor(3)).toBe('#3B82F6') })
    test('level 10 -> bronze (#B45309)', () => { expect(getTierColor(10)).toBe('#B45309') })
    test('level 20 -> silver (#94A3B8)', () => { expect(getTierColor(20)).toBe('#94A3B8') })
    test('level 30 -> gold (#D97706)', () => { expect(getTierColor(30)).toBe('#D97706') })
    test('level 50 -> platinum (#0EA5E9)', () => { expect(getTierColor(50)).toBe('#0EA5E9') })
    test('level 75 -> diamond (#8B5CF6)', () => { expect(getTierColor(75)).toBe('#8B5CF6') })
    test('level 100 -> legend (#F97316)', () => { expect(getTierColor(100)).toBe('#F97316') })
    test('level 9 is still Explorer color', () => { expect(getTierColor(9)).toBe('#3B82F6') })
    test('level 99 is still Diamond color', () => { expect(getTierColor(99)).toBe('#8B5CF6') })
    test('tier changes at exact boundaries', () => {
      expect(getTierColor(9)).toBe('#3B82F6')  // Explorer until 10
      expect(getTierColor(10)).toBe('#B45309') // Bronze from 10
      expect(getTierColor(19)).toBe('#B45309') // Bronze until 20
      expect(getTierColor(20)).toBe('#94A3B8') // Silver from 20
      expect(getTierColor(29)).toBe('#94A3B8') // Silver until 30
      expect(getTierColor(30)).toBe('#D97706') // Gold from 30
    })
  })

  describe('LEVEL_THRESHOLDS', () => {
    test('has exactly 100 entries', () => {
      expect(LEVEL_THRESHOLDS.length).toBe(100)
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
