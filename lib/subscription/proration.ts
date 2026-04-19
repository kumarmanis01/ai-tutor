/**
 * FILE OBJECTIVE:
 * - Compatibility shim re-exporting proration helpers from the new billing location.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/proration.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-19T00:00:00Z | copilot | add compatibility shim for proration helpers
 */

export { calculateProrationCredit, computeProratedCredit } from '@/lib/billing/proration'
export { default } from '@/lib/billing/proration'
