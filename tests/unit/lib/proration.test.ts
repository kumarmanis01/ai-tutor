/**
 * FILE OBJECTIVE:
 * - Unit tests for subscription proration utility.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/proration.test.ts
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created proration unit tests
 */

import { calculateProrationCredit } from '@/lib/subscription/proration';

describe('calculateProrationCredit', () => {
  test('calculates credit proportionally for remaining days', () => {
    const start = new Date('2026-03-01T00:00:00.000Z');
    const end = new Date('2026-03-31T00:00:00.000Z'); // 30 days
    const now = new Date('2026-03-11T00:00:00.000Z'); // 10 days elapsed, 20 remaining

    const res = calculateProrationCredit({
      startDate: start,
      endDate: end,
      now,
      billedRupees: 300,
    });

    expect(res.totalDays).toBeGreaterThanOrEqual(30);
    expect(res.remainingDays).toBeGreaterThanOrEqual(20);
    // Expected credit ~= 300 * (20/30) = 200
    expect(res.creditRupees).toBeCloseTo(200, 2);
  });

  test('returns zero for expired periods', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-01-31T00:00:00.000Z');
    const now = new Date('2026-02-10T00:00:00.000Z');

    const res = calculateProrationCredit({
      startDate: start,
      endDate: end,
      now,
      billedRupees: 500,
    });
    expect(res.creditRupees).toBe(0);
    expect(res.remainingDays).toBe(0);
  });
});
