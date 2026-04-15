/**
 * FILE OBJECTIVE:
 * - Store WhatsApp message templates for trial nudges (day-2, day-5, day-12).
 * - Templates are provider-agnostic and intended for Business API submission.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/whatsapp/templates.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot-planner | added WhatsApp trial nudge templates
 */

export const TRIAL_TEMPLATES = {
  DAY_2: {
    key: 'TRIAL_DAY_2',
    message: "Your child solved {{count}} questions in 2 days 🎉 Keep the streak going — try the 10‑minute Quick Practice now: {{link}}",
    description: 'Progress nudge with link to quick practice',
  },
  DAY_5: {
    key: 'TRIAL_DAY_5',
    message: "Progress update: Strong areas: {{strong}}. Weak area: {{weak}}. Suggested: 3 practice sets today → start: {{link}}",
    description: 'Weak area + action nudge',
  },
  DAY_12: {
    key: 'TRIAL_DAY_12',
    message: "Your 14-day trial ends in 2 days. Continue learning for just ₹399/month (No extra charges). Upgrade now: {{link}}",
    description: 'Trial ending urgency nudge with price',
  },
}

export default TRIAL_TEMPLATES
