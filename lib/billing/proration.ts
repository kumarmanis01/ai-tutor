/**
 * FILE OBJECTIVE:
 * - Proration helper utilities for billing. Provides both paise-based and
 *   rupee-friendly helpers used across the codebase.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/subscription/proration.test.ts (imports updated to this path)
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | moved from lib/subscription/proration.ts
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

  const billedPaise = Math.round(input.billedRupees * 100);
  const fraction = remainingMs / totalMs;
  const creditPaise = Math.floor(billedPaise * fraction);

  const creditRupees = Number((creditPaise / 100).toFixed(2));
  return { totalDays, remainingDays, creditRupees };
}

export function computeProratedCredit(
  startIso: string | Date,
  endIso: string | Date,
  paidAmountPaise: number,
  nowDate?: Date
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
