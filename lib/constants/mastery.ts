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
 */

export const LOW_ACCURACY_THRESHOLD = 0.6;

export const MASTERY_LEVELS = {
  beginner: { minAccuracy: 0, minAttempts: 0 },
  intermediate: { minAccuracy: 0.6, minAttempts: 5 },
  advanced: { minAccuracy: 0.75, minAttempts: 10 },
  expert: { minAccuracy: 0.9, minAttempts: 20 },
} as const;
