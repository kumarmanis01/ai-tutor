/**
 * FILE OBJECTIVE:
 * - Centralise daily study duration limits per subscription tier so they are
 *   referenced from a single source of truth across enforcement logic, jobs,
 *   and UI copy.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/constants/studyLimits.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | created for daily study duration enforcement (30 min free / 60 min premium)
 */

/**
 * Daily study duration limits (in minutes) by subscription tier.
 *
 * Free users  : 30 minutes per calendar day (UTC midnight reset).
 * Premium users: 60 minutes per calendar day (UTC midnight reset).
 *
 * These limits apply only to AI tutor sessions.  Diagnostic, test and
 * homework flows are not counted against this limit.
 */
export const DAILY_STUDY_LIMIT_MINUTES = {
  free: 30,
  premium: 60,
} as const

export type StudyTier = keyof typeof DAILY_STUDY_LIMIT_MINUTES

/** Human-readable copy used in API error responses and UI. */
export const DAILY_STUDY_LIMIT_COPY = {
  free: '30 minutes',
  premium: '60 minutes',
} as const

const studyLimitsConstants = { DAILY_STUDY_LIMIT_MINUTES, DAILY_STUDY_LIMIT_COPY }
export default studyLimitsConstants
