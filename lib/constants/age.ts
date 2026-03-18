/**
 * Age thresholds used across onboarding, auth, and profile guards.
 * Centralised here so the DPDP threshold is never hardcoded in business logic.
 */

/** Indian DPDP Act 2023 — parental consent required below this age. */
export const DPDP_MINOR_AGE = 13;

/** Youngest student age accepted during onboarding. */
export const MIN_STUDENT_AGE = 5;

/** Oldest student age accepted during onboarding. */
export const MAX_STUDENT_AGE = 25;
