/**
 * FILE OBJECTIVE:
 * - Centralized free-tier copy constants to unify wording across components.
 *
 * LINKED UNIT TEST:
 * - tests/unit/docs/free_tier_constants.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T11:32:00Z | copilot | created
 */

export const FREE_SESSIONS_TEXT = 'Start For Free';
export const FREE_SESSIONS_TEXT_HI = 'मुफ़्त में शुरू करें';

const FREE_TIER_COPY = { FREE_SESSIONS_TEXT, FREE_SESSIONS_TEXT_HI };
export default FREE_TIER_COPY;

/** Indian DPDP Act 2023 -- parental consent required below this age. */
export const DAILY_FREE_QUESTION_LIMIT = 5;