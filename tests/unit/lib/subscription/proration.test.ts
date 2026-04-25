import computeProratedCredit from '@/lib/billing/proration';

describe('computeProratedCredit', () => {
  test('returns 0 when no remaining time', () => {
    const start = new Date(2026, 0, 1); // Jan 1
    const end = new Date(2026, 0, 11); // Jan 11 (10 days)
    const now = new Date(2026, 0, 11); // at end
    const credit = computeProratedCredit(start, end, 10000, now);
    expect(credit).toBe(0);
  });

  test('calculates exact prorated credit for half remaining period', () => {
    const start = new Date(2026, 0, 1); // Jan 1
    const end = new Date(2026, 0, 11); // Jan 11 (10 days)
    const now = new Date(2026, 0, 6); // Jan 6 (5 days remaining)
    const paid = 10000; // paise
    const credit = computeProratedCredit(start, end, paid, now);
    // 5/10 of 10000 = 5000
    expect(credit).toBe(5000);
  });
});
