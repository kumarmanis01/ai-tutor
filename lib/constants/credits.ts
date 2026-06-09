/**
 * FILE OBJECTIVE:
 * - Daily AI interaction credit limits keyed by user plan (free vs paid).
 *
 * LINKED UNIT TEST:
 * - tests/unit/credits/dailyCredits.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | initial: DAILY_FREE_LIMIT and DAILY_PAID_LIMIT for task S1-3
 */

/** Maximum daily AI interactions for users on the free plan. */
export const DAILY_FREE_LIMIT = 50;

/** Maximum daily AI interactions for paid subscribers (399/month plan). */
export const DAILY_PAID_LIMIT = 200;
