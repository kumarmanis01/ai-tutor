/**
 * FILE OBJECTIVE:
 * - Proration helper utilities for subscriptions. Provides both a paise-based
 *   default helper used across the codebase and a rupee-friendly named helper
 *   used by legacy callers and tests.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/proration.test.ts
 * - tests/unit/lib/subscription/proration.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-12T00:00:00Z | copilot | resolved merge conflict; expose both paise and rupee helpers
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
 * Rupee-friendly helper kept for tests and callers that expect a structured
 * result. Internally uses integer paise math to avoid floating point errors.
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

  if (remainingMs <= 0) return { totalDays, remainingDays: 0, creditRupees: 0 };

  // Convert to paise for integer arithmetic
  const billedPaise = Math.round(input.billedRupees * 100);
  const fraction = remainingMs / totalMs;
  const creditPaise = Math.floor(billedPaise * fraction);

  const creditRupees = Math.round((creditPaise / 100) * 100) / 100;
  return { totalDays, remainingDays, creditRupees };
}

/**
 * Default paise-based helper used by services and lower-level code. Returns
 * integer paise credit for the unused portion of the period.
 */
export function computeProratedCredit(
  startIso: string | Date,
  endIso: string | Date,
  paidAmountPaise: number,
  nowDate?: Date,
): number {
  const start = typeof startIso === 'string' ? new Date(startIso) : startIso;
  const end = typeof endIso === 'string' ? new Date(endIso) : endIso;
  const now = nowDate ?? new Date();

  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 0;

  const remainingMs = Math.max(0, end.getTime() - now.getTime());
  if (remainingMs <= 0) return 0;

  const fraction = remainingMs / totalMs;
  const credit = Math.floor(paidAmountPaise * fraction);
  return credit;
}

export default computeProratedCredit;
