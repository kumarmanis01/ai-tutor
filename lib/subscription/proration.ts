/**
 * FILE OBJECTIVE:
 * - Utility functions to compute subscription proration and credits.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/proration.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | added proration utilities
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24

export interface ProrationInput {
  startDate: Date
  endDate: Date
  now?: Date
  billedRupees: number
}

export interface ProrationResult {
  totalDays: number
  remainingDays: number
  creditRupees: number
}

/**
 * Calculates prorated credit in rupees for the remaining portion of a billing period.
 * Returns totalDays, remainingDays and calculated credit (in rupees, float).
 */
export function calculateProrationCredit({ startDate, endDate, now = new Date(), billedRupees }: ProrationInput): ProrationResult {
  const totalMs = endDate.getTime() - startDate.getTime()
  const remainingMs = Math.max(0, endDate.getTime() - now.getTime())

  const totalDays = Math.max(0, Math.ceil(totalMs / MS_PER_DAY))
  const remainingDays = Math.max(0, Math.ceil(remainingMs / MS_PER_DAY))

  const ratio = totalDays > 0 ? remainingDays / totalDays : 0
  const creditRupees = Math.round((billedRupees * ratio) * 100) / 100

  return { totalDays, remainingDays, creditRupees }
}

/**
 * Default export used by server routes: compute prorated credit in paise.
 * Accepts start/end and paidAmountPaise (integer) and returns integer paise credit.
 */
export default function computeProratedCredit(startDate: Date, endDate: Date, paidAmountPaise: number, now: Date = new Date()): number {
  const totalMs = endDate.getTime() - startDate.getTime()
  const remainingMs = Math.max(0, endDate.getTime() - now.getTime())
  const totalDays = Math.max(0, Math.ceil(totalMs / MS_PER_DAY))
  const remainingDays = Math.max(0, Math.ceil(remainingMs / MS_PER_DAY))
  if (totalDays <= 0 || remainingDays <= 0 || paidAmountPaise <= 0) return 0
  const credit = Math.floor((paidAmountPaise * remainingDays) / totalDays)
  return Math.max(0, credit)
}
