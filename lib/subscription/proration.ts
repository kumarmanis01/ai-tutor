/**
 * FILE OBJECTIVE:
 * - Utility to calculate prorated credit for mid-cycle subscription changes.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/proration.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created proration utility
 */

export interface ProrationInput {
  startDate: Date | string;
  endDate: Date | string;
  now?: Date | string;
  billedRupees: number; // total amount paid for the billing period (includes GST)
}

export interface ProrationResult {
  totalDays: number;
  remainingDays: number;
  creditRupees: number;
}

/**
 * Calculate prorated credit (in rupees) for the unused portion of a billing period.
 * Rounds credit to two decimal places.
 */
export function calculateProrationCredit(input: ProrationInput): ProrationResult {
  const now = input.now ? new Date(input.now) : new Date();
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);

  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return { totalDays: 0, remainingDays: 0, creditRupees: 0 };

  const remainingMs = Math.max(0, end.getTime() - now.getTime());

  const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  const fraction = remainingMs / totalMs;
  const credit = Math.round(input.billedRupees * fraction * 100) / 100;

  return { totalDays, remainingDays, creditRupees: credit };
}

export default calculateProrationCredit;
