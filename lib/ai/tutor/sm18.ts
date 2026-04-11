/**
 * SM-18 spaced repetition: retention decay, stability update, next review interval.
 * Pure functions only -- no I/O, no side effects.
 */

export interface SM18Params {
  stability: number
  retention: number
  isCorrect: boolean
  elapsedDays: number
  /** AC-07: pass 0.92 in pre-exam mode (<= 14 days to exam) for shorter intervals. */
  targetRetention?: number
}

export interface SM18Result {
  newStability: number
  newRetention: number
  nextReviewInDays: number
}

const TARGET_RETENTION = 0.9
const NEXT_REVIEW_MIN_DAYS = 1
const NEXT_REVIEW_MAX_DAYS = 180

/**
 * Retention decay: R = exp(-elapsedDays / stability). Clamped 0.0-1.0.
 *
 * @param elapsedDays - Days since last interaction.
 * @param stability - Current memory stability in days.
 * @returns Retention in [0, 1].
 */
export function computeRetention(elapsedDays: number, stability: number): number {
  if (!Number.isFinite(elapsedDays) || elapsedDays <= 0) return 1.0
  if (!Number.isFinite(stability) || stability <= 0) return 0
  const r = Math.exp(-elapsedDays / stability)
  return Math.max(0, Math.min(1, r))
}

/**
 * Stability update after review.
 * Correct: newStability = stability * (1 + 0.2 * retention).
 * Wrong: newStability = max(1, stability * 0.5).
 *
 * @param stability - Current stability in days.
 * @param retention - Current retention 0.0-1.0.
 * @param isCorrect - Whether the review was answered correctly.
 * @returns Updated stability in days (≥ 1 on wrong).
 */
export function updateStability(stability: number, retention: number, isCorrect: boolean): number {
  const s = Number.isFinite(stability) && stability > 0 ? stability : 1
  const r = Number.isFinite(retention) ? Math.max(0, Math.min(1, retention)) : 0
  if (isCorrect) {
    return s * (1 + 0.2 * r)
  }
  return Math.max(1, s * 0.5)
}

/**
 * Next review interval in days.
 *
 * Derived from the retention decay model R = exp(-t / S):
 *   t = -S * ln(targetRetention)
 * Normalised by -ln(0.9) so that interval = newStability when targetRetention = 0.90.
 * Formula: newStability * ln(targetRetention) / ln(0.9), clamped [1, 180].
 *
 * With default targetRetention = 0.90: ratio = ln(0.9)/ln(0.9) = 1  ->  interval = newStability.
 * AC-07 (F-STU-022): pass targetRetention = 0.92 in pre-exam mode (<= 14 days to exam).
 * Higher targetRetention produces a SHORTER interval (more frequent reviews):
 *   0.92 -> ratio ≈ 0.79 (<1) -> shorter interval to reinforce memory aggressively.
 *   0.80 -> ratio ≈ 2.12 (>1) -> longer interval when lower retention is acceptable.
 *
 * @param newStability - Stability after update, in days.
 * @param targetRetention - Desired retention at next review, default 0.9.
 * @returns Days until next review, in [1, 180].
 */
export function computeNextReviewDays(newStability: number, targetRetention = TARGET_RETENTION): number {
  if (!Number.isFinite(newStability) || newStability <= 0) return NEXT_REVIEW_MIN_DAYS
  const tr = Number.isFinite(targetRetention) && targetRetention > 0 && targetRetention < 1
    ? targetRetention
    : TARGET_RETENTION
  // ln(tr)/ln(0.9): higher tr (e.g. 0.92) -> ratio < 1 -> shorter interval (more frequent review)
  const interval = newStability * (Math.log(tr) / Math.log(TARGET_RETENTION))
  const days = Math.max(NEXT_REVIEW_MIN_DAYS, Math.min(NEXT_REVIEW_MAX_DAYS, Math.round(interval)))
  return days
}

/**
 * Full SM-18 update: compute retention from elapsed, update stability, compute next review.
 *
 * @param params - stability, retention (current), isCorrect, elapsedDays.
 * @returns newStability, newRetention (target at next review = 0.9), nextReviewInDays.
 */
export function updateSM18(params: SM18Params): SM18Result {
  const retention = computeRetention(params.elapsedDays, params.stability)
  const newStability = updateStability(params.stability, retention, params.isCorrect)
  const nextReviewInDays = computeNextReviewDays(newStability, params.targetRetention)
  return {
    newStability,
    newRetention: TARGET_RETENTION,
    nextReviewInDays,
  }
}
