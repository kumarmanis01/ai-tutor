/**
 * FILE OBJECTIVE:
 * - Small helpers used by the parent dashboard: localized UI snippets,
 *   predicted mark range calculation, and mastery percentage conversion.
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
 */

export const LOCAL_STRINGS: Record<string, Record<string, string>> = {
  en: {
    whatThisMeansPrefix: 'What this means:',
    predictedRangeLabel: 'Predicted board score',
    benchmarkingOptInLabel: 'Show anonymized benchmarking',
    benchmarkingCopy: "Your child's mastery is above {pct}% of students in their grade on our platform.",
  },
  hi: {
    whatThisMeansPrefix: 'इसका क्या मतलब है:',
    predictedRangeLabel: 'अनुमानित बोर्ड अंक',
    benchmarkingOptInLabel: 'सांख्यिकीय तुलना दिखाएँ (अनामित)',
    benchmarkingCopy: 'आपके बच्चे की महारत हमारे मंच पर उनके कक्षा के {pct}% छात्रों से ऊपर है।',
  },
}

/**
 * Predict a conservative mark range from a readiness score (0-100).
 * Returns [min, max] clamped to [0,100].
 */
export function predictMarkRange(score: number): [number, number] {
  const safe = Number.isFinite(score) ? Math.round(score) : 0
  const delta = Math.max(6, Math.round(safe * 0.08))
  const min = Math.max(0, safe - delta)
  const max = Math.min(100, safe + delta)
  return [min, max]
}

/**
 * Convert average mastery stored as 0..4 to percentage value 0..100.
 */
export function masteryPercentFromAverage(avg4: number) {
  if (!Number.isFinite(avg4)) return 0
  return Math.round((avg4 / 4) * 100)
}
