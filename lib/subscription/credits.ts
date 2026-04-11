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
