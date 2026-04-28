/**
 * FILE OBJECTIVE:
 * - Centralize mastery thresholds and levels for all engine and UI logic.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/constants/mastery.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-23T00:00:00Z | copilot | created for threshold refactor
 * - 2026-03-07 | claude | Phase 4: added SPACED_REVISION_INTERVALS for dynamic spaced repetition
 */

export const LOW_ACCURACY_THRESHOLD = 0.6;

export const MASTERY_LEVELS = {
  beginner: { minAccuracy: 0, minAttempts: 0 },
  intermediate: { minAccuracy: 0.6, minAttempts: 5 },
  advanced: { minAccuracy: 0.75, minAttempts: 10 },
  expert: { minAccuracy: 0.9, minAttempts: 20 },
} as const;

/**
 * Spaced-repetition interval table for p3_spacedRevision.
 * Maps mastery band [min, max) → review interval in days.
 * A topic whose daysSince >= intervalDays is overdue for revision.
 * Bands are contiguous and cover the full [0.40, 1.00] range.
 */
export const SPACED_REVISION_INTERVALS = [
  { min: 0.4, max: 0.6, intervalDays: 3 },
  { min: 0.6, max: 0.75, intervalDays: 7 },
  { min: 0.75, max: 0.9, intervalDays: 14 },
  { min: 0.9, max: 1.0, intervalDays: 30 },
] as const;
