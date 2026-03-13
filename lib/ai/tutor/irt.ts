/**
 * 3PL IRT and theta-update logic. Pure functions only — no I/O, no side effects.
 */

export interface IRTParams {
  theta: number
  b: number
  a?: number
  c?: number
}

export interface IRTUpdateResult {
  newTheta: number
  newMastery: number
  probabilityCorrect: number
}

const DEFAULT_A = 1.0
const DEFAULT_C = 0.2
const LEARNING_RATE = 0.3
const DELTA_THETA_CAP = 0.5
const THETA_MIN = -3
const THETA_MAX = 3
const MASTERY_LOGISTIC_K = 0.8

/**
 * 3PL probability of correct response.
 * P(X=1|θ) = c + (1-c) / (1 + exp(-a*(θ-b)))
 *
 * @param params - theta (ability), b (item difficulty), optional a (discrimination), c (pseudo-guessing).
 * @returns Probability in [0, 1]. Returns c for invalid/NaN theta to stay pure and finite.
 */
export function probability3PL(params: IRTParams): number {
  const theta = Number.isFinite(params.theta) ? params.theta : params.b
  const b = Number.isFinite(params.b) ? params.b : 0
  const a = Number.isFinite(params.a) && params.a! > 0 ? params.a! : DEFAULT_A
  const c = typeof params.c === 'number' && params.c >= 0 && params.c <= 1 ? params.c : DEFAULT_C
  const expArg = -a * (theta - b)
  if (!Number.isFinite(expArg)) return c
  const expVal = Math.exp(expArg)
  if (!Number.isFinite(expVal) || expVal === Infinity) return theta > b ? 1 : c
  const p = c + (1 - c) / (1 + expVal)
  return Math.max(0, Math.min(1, p))
}

/**
 * MAP theta update (simplified gradient step).
 * Δθ = learningRate * (isCorrect - P) * a, bounded to [-0.5, +0.5]; θ clamped to [-3, +3].
 *
 * @param params - Current IRT params (theta, b, a, c).
 * @param isCorrect - Whether the response was correct.
 * @returns New theta, derived mastery, and P(correct) before update.
 */
export function updateTheta(params: IRTParams, isCorrect: boolean): IRTUpdateResult {
  const p = probability3PL(params)
  const a = Number.isFinite(params.a) && params.a! > 0 ? params.a! : DEFAULT_A
  const theta = Number.isFinite(params.theta) ? params.theta : 0
  const rawDelta = LEARNING_RATE * ((isCorrect ? 1 : 0) - p) * a
  const delta = Math.max(-DELTA_THETA_CAP, Math.min(DELTA_THETA_CAP, rawDelta))
  let newTheta = theta + delta
  newTheta = Math.max(THETA_MIN, Math.min(THETA_MAX, newTheta))
  const newMastery = thetaToMastery(newTheta)
  return {
    newTheta,
    newMastery,
    probabilityCorrect: p,
  }
}

/**
 * Convert theta to mastery score 0.0–1.0.
 * mastery = 1 / (1 + exp(-0.8 * theta))
 *
 * @param theta - IRT ability estimate.
 * @returns Mastery in [0, 1].
 */
export function thetaToMastery(theta: number): number {
  if (!Number.isFinite(theta)) return 0.5
  const x = MASTERY_LOGISTIC_K * theta
  if (x >= 40) return 1
  if (x <= -40) return 0
  const e = Math.exp(-x)
  return 1 / (1 + e)
}
