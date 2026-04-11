import { predictMarkRange, masteryPercentFromAverage, LOCAL_STRINGS } from '@/lib/parent/dashboardHelpers'

describe('dashboardHelpers', () => {
  test('predictMarkRange: zero score', () => {
    expect(predictMarkRange(0)).toEqual([0, 6])
  })

  test('predictMarkRange: mid score', () => {
    // 50 -> delta = max(6, round(4)) = 6
    expect(predictMarkRange(50)).toEqual([44, 56])
  })

  test('predictMarkRange: high score clamps at 100', () => {
    const [min, max] = predictMarkRange(98)
    expect(min).toBeGreaterThanOrEqual(0)
    expect(max).toBeLessThanOrEqual(100)
  })

  test('masteryPercentFromAverage', () => {
    expect(masteryPercentFromAverage(4)).toBe(100)
    expect(masteryPercentFromAverage(2)).toBe(50)
    expect(masteryPercentFromAverage(0)).toBe(0)
  })

  test('LOCAL_STRINGS has en and hi keys', () => {
    expect(LOCAL_STRINGS.en).toBeDefined()
    expect(LOCAL_STRINGS.hi).toBeDefined()
    expect(LOCAL_STRINGS.en.whatThisMeansPrefix).toContain('What')
    expect(LOCAL_STRINGS.hi.whatThisMeansPrefix).toContain('इसका')
  })
})
