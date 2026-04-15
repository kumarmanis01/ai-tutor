/**
 * FILE OBJECTIVE:
 * - Paise-based helper to apply stored credits to a charge.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/subscription/credits.test.ts (imports updated to this path)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | moved from lib/subscription/credits.ts
 */

/**
 * Helpers for applying stored credits to charges.
 * All amounts are integers in paise.
 */
export function applyCreditsToCharge(amountPaise: number, creditBalancePaise: number) {
  const credit = Math.max(0, Math.floor(creditBalancePaise || 0));
  if (credit >= amountPaise) {
    return { netAmountPaise: 0, remainingCreditPaise: credit - amountPaise };
  }
  return { netAmountPaise: amountPaise - credit, remainingCreditPaise: 0 };
}

export default applyCreditsToCharge;
