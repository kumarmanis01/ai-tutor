import {
  predictMarkRange,
  masteryPercentFromAverage,
  predictDaysToReadiness,
  LOCAL_STRINGS,
  PLATFORM_DEFAULT_GAIN_PER_SESSION,
} from '@/lib/parent/dashboardHelpers'

describe('predictMarkRange', () => {
  test('zero score', () => {
    expect(predictMarkRange(0)).toEqual([0, 6])
  })

  test('mid score', () => {
    // 50 -> delta = max(6, round(4)) = 6
    expect(predictMarkRange(50)).toEqual([44, 56])
  })

  test('high score clamps at 100', () => {
    const [min, max] = predictMarkRange(98)
    expect(min).toBeGreaterThanOrEqual(0)
    expect(max).toBeLessThanOrEqual(100)
  })
})

describe('masteryPercentFromAverage', () => {
  test('converts 0-4 scale to 0-100', () => {
    expect(masteryPercentFromAverage(4)).toBe(100)
    expect(masteryPercentFromAverage(2)).toBe(50)
    expect(masteryPercentFromAverage(0)).toBe(0)
  })

  test('returns 0 for non-finite input', () => {
    expect(masteryPercentFromAverage(NaN)).toBe(0)
  })
})

describe('LOCAL_STRINGS', () => {
  test('has en and hi keys', () => {
    expect(LOCAL_STRINGS.en).toBeDefined()
    expect(LOCAL_STRINGS.hi).toBeDefined()
    expect(LOCAL_STRINGS.en.whatThisMeansPrefix).toContain('What')
    expect(LOCAL_STRINGS.hi.whatThisMeansPrefix).toContain('\u0907\u0938\u0915\u093e')
  })
})

describe('predictDaysToReadiness (F-PAR-012 AC-05)', () => {
  test('should return estimatedDays=0 when already at or above target', () => {
    expect(predictDaysToReadiness(80, 80, 5, 1.5)).toEqual({ feasible: true, estimatedDays: 0 })
    expect(predictDaysToReadiness(90, 80, 5, 1.5)).toEqual({ feasible: true, estimatedDays: 0 })
  })

  test('should compute correct days for simple case', () => {
    // gap=20, gain=2/session, 5 sessions/week => ceil(10 sessions) => ceil(14 days)
    const result = predictDaysToReadiness(60, 80, 5, 2)
    expect(result.feasible).toBe(true)
    expect(result.estimatedDays).toBe(14)
  })

  test('should use platform default gain when avgGainPerSession is 0', () => {
    const result = predictDaysToReadiness(60, 80, 5, 0)
    expect(result.feasible).toBe(true)
    const sessionsNeeded = Math.ceil(20 / PLATFORM_DEFAULT_GAIN_PER_SESSION)
    const expected = Math.max(1, Math.ceil((sessionsNeeded / 5) * 7))
    expect(result.estimatedDays).toBe(expected)
  })

  test('should return feasible=false when avgWeeklySessions is 0', () => {
    const result = predictDaysToReadiness(60, 80, 0, 1.5)
    expect(result.feasible).toBe(false)
    expect(result.estimatedDays).toBeNull()
  })

  test('should return feasible=false for non-finite score inputs', () => {
    expect(predictDaysToReadiness(NaN, 80, 5, 1.5).feasible).toBe(false)
    expect(predictDaysToReadiness(60, NaN, 5, 1.5).feasible).toBe(false)
  })

  test('estimatedDays is always at least 1 when feasible and not at target', () => {
    const result = predictDaysToReadiness(79, 80, 100, 100)
    expect(result.estimatedDays).toBeGreaterThanOrEqual(1)
  })
})
