/**
 * FILE OBJECTIVE:
 * - Small helpers used by the parent dashboard: localized UI snippets,
 *   predicted mark range calculation, mastery percentage conversion, and
 *   readiness pace prediction (F-PAR-012 AC-05).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/parent/dashboardHelpers.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | added helper utilities for parent dashboard
 * - 2026-04-14T00:00:00Z | claude | added predictDaysToReadiness (F-PAR-012 AC-05)
 * - 2026-04-14T00:00:00Z | assistant | corrected Copilot instructions header path typo
 */

export const LOCAL_STRINGS: Record<string, Record<string, string>> = {
  en: {
    whatThisMeansPrefix: 'What this means:',
    predictedRangeLabel: 'Predicted board score',
    benchmarkingOptInLabel: 'Show anonymized benchmarking',
    benchmarkingCopy:
      "Your child's mastery is above {pct}% of students in their grade on our platform.",
  },
  hi: {
    whatThisMeansPrefix:
      '\u0907\u0938\u0915\u093e \u0915\u094d\u092f\u093e \u092e\u0924\u0932\u092c \u0939\u0948:',
    predictedRangeLabel:
      '\u0905\u0928\u0941\u092e\u093e\u0928\u093f\u062a \u092c\u094b\u0930\u094d\u0921 \u0905\u0902\u0915',
    benchmarkingOptInLabel:
      '\u0938\u093e\u0902\u0916\u094d\u092f\u093f\u0915\u0940\u092f \u062a\u0941\u0932\u0928\u093e \u0926\u093f\u0916\u093e\u090f\u0902 (\u0905\u0928\u093e\u092e\u093f\u0924)',
    benchmarkingCopy:
      '\u0906\u092a\u0915\u0947 \u092c\u091a\u094d\u091a\u0947 \u0915\u0940 \u092e\u0939\u093e\u0930\u0924 \u0939\u092e\u093e\u0930\u0947 \u092e\u0902\u091a \u092a\u0930 \u0909\u0928\u0915\u0947 \u0915\u0915\u094d\u0937\u093e \u0915\u0947 {pct}% \u091b\u093e\u0924\u094d\u0930\u094b\u0902 \u0938\u0947 \u0913\u092a\u0930 \u0939\u0948\u0964',
  },
};

/**
 * Predict a conservative mark range from a readiness score (0-100).
 * Returns [min, max] clamped to [0,100].
 */
export function predictMarkRange(score: number): [number, number] {
  const safe = Number.isFinite(score) ? Math.round(score) : 0;
  const delta = Math.max(6, Math.round(safe * 0.08));
  const min = Math.max(0, safe - delta);
  const max = Math.min(100, safe + delta);
  return [min, max];
}

/**
 * Convert average mastery stored as 0..4 to percentage value 0..100.
 */
export function masteryPercentFromAverage(avg4: number) {
  if (!Number.isFinite(avg4)) return 0;
  return Math.round((avg4 / 4) * 100);
}

/**
 * Predict days to reach a readiness target at the current study pace.
 * F-PAR-012 AC-05: "Predicted study time to exam readiness 80%".
 *
 * @param currentScore   Current readiness score (0-100).
 * @param targetScore    Target readiness score (default 80).
 * @param avgWeeklySessions  Average sessions per week over recent history.
 * @param avgGainPerSession  Average readiness points gained per session.
 *                           Falls back to PLATFORM_DEFAULT_GAIN when 0/unknown.
 *
 * Returns:
 *   { feasible: true, estimatedDays: number } when a prediction is possible.
 *   { feasible: false, estimatedDays: null }  when pace is zero (no sessions).
 *   { feasible: true, estimatedDays: 0 }      when already at/above target.
 */
export const PLATFORM_DEFAULT_GAIN_PER_SESSION = 1.5; // readiness points per session (platform average)

export function predictDaysToReadiness(
  currentScore: number,
  targetScore: number,
  avgWeeklySessions: number,
  avgGainPerSession: number
): { feasible: boolean; estimatedDays: number | null } {
  if (!Number.isFinite(currentScore) || !Number.isFinite(targetScore)) {
    return { feasible: false, estimatedDays: null };
  }
  if (currentScore >= targetScore) return { feasible: true, estimatedDays: 0 };
  if (!Number.isFinite(avgWeeklySessions) || avgWeeklySessions <= 0) {
    return { feasible: false, estimatedDays: null };
  }
  const effectiveGain =
    Number.isFinite(avgGainPerSession) && avgGainPerSession > 0
      ? avgGainPerSession
      : PLATFORM_DEFAULT_GAIN_PER_SESSION;
  const gap = targetScore - currentScore;
  const sessionsNeeded = Math.ceil(gap / effectiveGain);
  const daysNeeded = Math.ceil((sessionsNeeded / avgWeeklySessions) * 7);
  return { feasible: true, estimatedDays: Math.max(1, daysNeeded) };
}
