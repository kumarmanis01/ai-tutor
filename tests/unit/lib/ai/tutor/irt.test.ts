import {
  probability3PL,
  updateTheta,
  thetaToMastery,
  type IRTParams,
} from '@/lib/ai/tutor/irt'

describe('probability3PL', () => {
  test('at θ=b with c=0.2, a=1 gives ≈0.60', () => {
    const p = probability3PL({ theta: 0.5, b: 0.5, a: 1, c: 0.2 })
    expect(p).toBeCloseTo(0.6, 2)
  })

  test('θ >> b approaches 1.0', () => {
    const p = probability3PL({ theta: 5, b: -2, a: 1, c: 0.2 })
    expect(p).toBeGreaterThan(0.95)
  })

  test('θ << b approaches c', () => {
    const p = probability3PL({ theta: -5, b: 2, a: 1, c: 0.2 })
    expect(p).toBeCloseTo(0.2, 2)
  })

  test('defaults: a=1, c=0.2', () => {
    const p = probability3PL({ theta: 0, b: 0 })
    expect(p).toBeCloseTo(0.6, 2)
  })

  test('pure: same inputs → same output', () => {
    const params: IRTParams = { theta: 0.3, b: -0.5, a: 1.2, c: 0.15 }
    expect(probability3PL(params)).toBe(probability3PL(params))
  })

  test('adversarial: NaN theta uses safe behavior or stays finite', () => {
    const p = probability3PL({ theta: NaN, b: 0, a: 1, c: 0.2 })
    expect(Number.isFinite(p) || p === 0.2).toBe(true)
  })

  test('adversarial: very large theta', () => {
    const p = probability3PL({ theta: 1e10, b: 0, a: 1, c: 0.2 })
    expect(p).toBeGreaterThanOrEqual(0.2)
    expect(p).toBeLessThanOrEqual(1)
  })

  test('adversarial: c=0', () => {
    const p = probability3PL({ theta: -10, b: 0, a: 1, c: 0 })
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThanOrEqual(1)
  })
})

describe('updateTheta', () => {
  test('correct answer → theta increases', () => {
    const result = updateTheta({ theta: 0, b: 0.5, a: 1, c: 0.2 }, true)
    expect(result.newTheta).toBeGreaterThan(0)
  })

  test('wrong answer → theta decreases', () => {
    const result = updateTheta({ theta: 0, b: 0.5, a: 1, c: 0.2 }, false)
    expect(result.newTheta).toBeLessThan(0)
  })

  test('|Δtheta| ≤ 0.5', () => {
    const r1 = updateTheta({ theta: 0, b: -10, a: 10, c: 0 }, true)
    expect(Math.abs(r1.newTheta - 0)).toBeLessThanOrEqual(0.5 + 1e-9)
    const r2 = updateTheta({ theta: 0, b: 10, a: 10, c: 0 }, false)
    expect(Math.abs(r2.newTheta - 0)).toBeLessThanOrEqual(0.5 + 1e-9)
  })

  test('theta clamped at +3', () => {
    const result = updateTheta({ theta: 2.8, b: -5, a: 2, c: 0 }, true)
    expect(result.newTheta).toBeLessThanOrEqual(3)
  })

  test('theta clamped at -3', () => {
    const result = updateTheta({ theta: -2.8, b: 5, a: 2, c: 0 }, false)
    expect(result.newTheta).toBeGreaterThanOrEqual(-3)
  })

  test('probabilityCorrect is P before update', () => {
    const params: IRTParams = { theta: 0.2, b: 0.3, a: 1, c: 0.2 }
    const expectedP = probability3PL(params)
    const result = updateTheta(params, true)
    expect(result.probabilityCorrect).toBeCloseTo(expectedP, 10)
  })

  test('newMastery in [0, 1]', () => {
    const result = updateTheta({ theta: 0, b: 0, a: 1, c: 0.2 }, true)
    expect(result.newMastery).toBeGreaterThanOrEqual(0)
    expect(result.newMastery).toBeLessThanOrEqual(1)
  })

  test('pure: same inputs → same output', () => {
    const params: IRTParams = { theta: 0.1, b: -0.2, a: 1, c: 0.2 }
    const a = updateTheta(params, true)
    const b = updateTheta(params, true)
    expect(a.newTheta).toBe(b.newTheta)
    expect(a.newMastery).toBe(b.newMastery)
  })

  test('adversarial: theta 3, correct answer keeps at 3', () => {
    const result = updateTheta({ theta: 3, b: 0, a: 1, c: 0.2 }, true)
    expect(result.newTheta).toBeLessThanOrEqual(3)
  })

  test('adversarial: theta -3, wrong answer keeps at -3', () => {
    const result = updateTheta({ theta: -3, b: 0, a: 1, c: 0.2 }, false)
    expect(result.newTheta).toBeGreaterThanOrEqual(-3)
  })
})

describe('thetaToMastery', () => {
  test('thetaToMastery(0) === 0.5', () => {
    expect(thetaToMastery(0)).toBe(0.5)
  })

  test('thetaToMastery(3) > 0.9', () => {
    expect(thetaToMastery(3)).toBeGreaterThan(0.9)
  })

  test('thetaToMastery(-3) < 0.1', () => {
    expect(thetaToMastery(-3)).toBeLessThan(0.1)
  })

  test('monotonic increasing', () => {
    expect(thetaToMastery(-1)).toBeLessThan(thetaToMastery(0))
    expect(thetaToMastery(0)).toBeLessThan(thetaToMastery(1))
  })

  test('pure: same input → same output', () => {
    expect(thetaToMastery(0.7)).toBe(thetaToMastery(0.7))
  })

  test('adversarial: very large theta', () => {
    const m = thetaToMastery(100)
    expect(m).toBeGreaterThanOrEqual(0)
    expect(m).toBeLessThanOrEqual(1)
  })

  test('adversarial: very negative theta', () => {
    const m = thetaToMastery(-100)
    expect(m).toBeGreaterThanOrEqual(0)
    expect(m).toBeLessThanOrEqual(1)
  })
})
