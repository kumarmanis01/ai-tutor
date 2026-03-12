import {
  computeRetention,
  updateStability,
  computeNextReviewDays,
  updateSM18,
  type SM18Params,
} from '@/lib/ai/tutor/sm18'

const MS_PER_DAY = 86400000

describe('computeRetention', () => {
  test('computeRetention(0, 5) = 1.0 (no decay at day 0)', () => {
    expect(computeRetention(0, 5)).toBe(1.0)
  })

  test('computeRetention(5, 5) ≈ exp(-1)', () => {
    const r = computeRetention(5, 5)
    expect(r).toBeCloseTo(Math.exp(-1), 5)
  })

  test('computeRetention(100, 1) ≈ 0 (clamped, not negative)', () => {
    const r = computeRetention(100, 1)
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(1)
    expect(r).toBeCloseTo(0, 2)
  })

  test('stability 0 does not throw', () => {
    const r = computeRetention(1, 0)
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(1)
  })

  test('pure: same inputs same output', () => {
    expect(computeRetention(3, 4)).toBe(computeRetention(3, 4))
  })
})

describe('updateStability', () => {
  test('correct review → stability increases', () => {
    const before = 5
    const after = updateStability(before, 0.8, true)
    expect(after).toBeGreaterThan(before)
  })

  test('wrong review → stability decreases', () => {
    const before = 10
    const after = updateStability(before, 0.5, false)
    expect(after).toBeLessThan(before)
  })

  test('wrong review stability never below 1', () => {
    expect(updateStability(1, 0, false)).toBeGreaterThanOrEqual(1)
    expect(updateStability(2, 0, false)).toBeGreaterThanOrEqual(1)
    expect(updateStability(1.5, 0, false)).toBeGreaterThanOrEqual(1)
  })

  test('correct: newStability = stability * (1 + 0.2 * retention)', () => {
    const s = 10
    const r = 0.5
    const after = updateStability(s, r, true)
    expect(after).toBeCloseTo(s * (1 + 0.2 * r), 10)
  })

  test('wrong: newStability = max(1, stability * 0.5)', () => {
    expect(updateStability(10, 0.5, false)).toBeCloseTo(5, 5)
    expect(updateStability(1, 0.5, false)).toBe(1)
  })
})

describe('computeNextReviewDays', () => {
  test('min = 1 even with stability = 0.001', () => {
    expect(computeNextReviewDays(0.001)).toBeGreaterThanOrEqual(1)
    expect(computeNextReviewDays(0.0001)).toBe(1)
  })

  test('max = 180 even with stability = 10000', () => {
    expect(computeNextReviewDays(10000)).toBeLessThanOrEqual(180)
    expect(computeNextReviewDays(100000)).toBe(180)
  })

  test('reasonable stability returns value in [1, 180]', () => {
    expect(computeNextReviewDays(5)).toBeGreaterThanOrEqual(1)
    expect(computeNextReviewDays(5)).toBeLessThanOrEqual(180)
  })

  test('pure: same input same output', () => {
    expect(computeNextReviewDays(7)).toBe(computeNextReviewDays(7))
  })
})

describe('updateSM18', () => {
  test('full update composes correctly', () => {
    const params: SM18Params = {
      stability: 5,
      retention: 0.8,
      isCorrect: true,
      elapsedDays: 2,
    }
    const result = updateSM18(params)
    expect(result.newStability).toBeGreaterThan(0)
    expect(result.newRetention).toBeGreaterThanOrEqual(0)
    expect(result.newRetention).toBeLessThanOrEqual(1)
    expect(result.nextReviewInDays).toBeGreaterThanOrEqual(1)
    expect(result.nextReviewInDays).toBeLessThanOrEqual(180)
  })

  test('high retention correct review → longer next interval', () => {
    const low = updateSM18({ stability: 5, retention: 0.3, isCorrect: true, elapsedDays: 0 })
    const high = updateSM18({ stability: 5, retention: 0.95, isCorrect: true, elapsedDays: 0 })
    expect(high.nextReviewInDays).toBeGreaterThanOrEqual(low.nextReviewInDays)
  })

  test('pure: same inputs same output', () => {
    const params: SM18Params = { stability: 3, retention: 0.7, isCorrect: true, elapsedDays: 1 }
    const a = updateSM18(params)
    const b = updateSM18(params)
    expect(a.newStability).toBe(b.newStability)
    expect(a.newRetention).toBe(b.newRetention)
    expect(a.nextReviewInDays).toBe(b.nextReviewInDays)
  })
})
