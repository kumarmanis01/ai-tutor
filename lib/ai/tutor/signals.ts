export type EmotionalState =
  | 'NEUTRAL'
  | 'ENGAGED'
  | 'CONFUSED'
  | 'FRUSTRATED'
  | 'DISTRESSED' // never set by this module -- reserved for safety layer

export interface TurnHistoryEntry {
  role: 'student' | 'ai'
  isCorrect: boolean | null // null for AI turns and non-answer turns
  hintsRequestedThisTurn: number // 0 or 1
  negativeLanguageDetected: boolean
  responseLatencyMs: number | null // null for AI turns
}

export interface FrustrationResult {
  frustrationScore: number // 0.0-1.0, clamped
  emotionalState: EmotionalState
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

/**
 * Compute the frustration score and derived emotional state from a history of
 * turns and an optional session baseline latency.
 *
 * @param history - Chronological history of turns (student + AI).
 * @param sessionBaselineLatencyMs - Baseline latency in ms; null = no latency component.
 * @returns FrustrationResult with score in [0.0, 1.0] and mapped EmotionalState.
 */
export function computeFrustrationScore(
  history: TurnHistoryEntry[],
  sessionBaselineLatencyMs: number | null,
): FrustrationResult {
  const studentTurns = history.filter((h) => h.role === 'student')

  if (studentTurns.length === 0) {
    return { frustrationScore: 0, emotionalState: 'NEUTRAL' }
  }

  // consecutiveWrong component (weight 0.40)
  let trailingWrong = 0
  for (let i = studentTurns.length - 1; i >= 0; i--) {
    const t = studentTurns[i]
    if (t.isCorrect === false) {
      trailingWrong += 1
    } else if (t.isCorrect === true) {
      break
    } else {
      // null correctness: doesn't break streak but also doesn't increment
      break
    }
  }
  let consecutiveWrongRaw = 0
  if (trailingWrong === 1) consecutiveWrongRaw = 0.33
  else if (trailingWrong === 2) consecutiveWrongRaw = 0.66
  else if (trailingWrong >= 3) consecutiveWrongRaw = 1.0
  const consecutiveWrongComponent = 0.40 * clamp01(consecutiveWrongRaw)

  // hintsUsed component (weight 0.20)
  const totalHints = studentTurns.reduce((sum, t) => sum + (t.hintsRequestedThisTurn || 0), 0)
  const hintsRaw = Math.min(totalHints, 3) / 3
  const hintsComponent = 0.20 * clamp01(hintsRaw)

  // negativeLanguage component (weight 0.30)
  const negCount = studentTurns.filter((t) => t.negativeLanguageDetected).length
  const negRaw = studentTurns.length > 0 ? negCount / studentTurns.length : 0
  const negativeLanguageComponent = 0.30 * clamp01(negRaw)

  // latencyRatio component (weight 0.10)
  let latencyComponent = 0
  if (sessionBaselineLatencyMs && sessionBaselineLatencyMs > 0) {
    const latencies = studentTurns
      .map((t) => t.responseLatencyMs)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0)
    if (latencies.length > 0) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const ratio = avg / sessionBaselineLatencyMs
      const capped = Math.min(ratio, 1)
      latencyComponent = 0.10 * clamp01(capped)
    }
  }

  const rawScore = consecutiveWrongComponent + hintsComponent + negativeLanguageComponent + latencyComponent
  const frustrationScore = clamp01(rawScore)

  // EmotionalState mapping
  let emotionalState: EmotionalState = 'NEUTRAL'

  if (frustrationScore >= 0.75) {
    emotionalState = 'FRUSTRATED'
  } else if (frustrationScore >= 0.45) {
    emotionalState = 'CONFUSED'
  } else {
    const anyNegativeLanguage = negCount > 0
    if (anyNegativeLanguage && frustrationScore < 0.45) {
      emotionalState = 'CONFUSED'
    } else if (frustrationScore < 0.20 && !anyNegativeLanguage) {
      emotionalState = 'ENGAGED'
    } else {
      emotionalState = 'NEUTRAL'
    }
  }

  // DISTRESSED is reserved for the safety layer; this module never emits it.

  return { frustrationScore, emotionalState }
}

