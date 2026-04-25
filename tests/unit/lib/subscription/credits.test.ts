import applyCreditsToCharge from '@/lib/billing/credits';

describe('applyCreditsToCharge', () => {
  test('reduces amount by credit when credit < amount', () => {
    const { netAmountPaise, remainingCreditPaise } = applyCreditsToCharge(10000, 3000);
    expect(netAmountPaise).toBe(7000);
    expect(remainingCreditPaise).toBe(0);
  });

  test('sets net to 0 and returns remaining credit when credit > amount', () => {
    const { netAmountPaise, remainingCreditPaise } = applyCreditsToCharge(10000, 15000);
    expect(netAmountPaise).toBe(0);
    expect(remainingCreditPaise).toBe(5000);
  });

  test('exact match yields zero and zero remaining', () => {
    const { netAmountPaise, remainingCreditPaise } = applyCreditsToCharge(10000, 10000);
    expect(netAmountPaise).toBe(0);
    expect(remainingCreditPaise).toBe(0);
  });
});
