/**
 * Unit tests for lib/freemium.ts
 *
 * AC-01: FREE_TIER_SESSION_LIMIT = 3
 * AC-05: daysUntilFreeTierReset() returns correct count
 *
 * DB-dependent functions (checkFreeTierCap, incrementFreeTierUsage,
 * getStudentsNearingReset) are covered by integration tests.
 */

import { FREE_TIER_SESSION_LIMIT, daysUntilFreeTierReset } from '@/lib/freemium';

describe('FREE_TIER_SESSION_LIMIT', () => {
  test('should be 3 per spec AC-01 (F-STU-040)', () => {
    expect(FREE_TIER_SESSION_LIMIT).toBe(3);
  });
});

describe('daysUntilFreeTierReset', () => {
  const RealDate = Date;

  afterEach(() => {
    // Restore global Date after each test
    global.Date = RealDate;
  });

  function mockDate(isoString: string) {
    const fixed = new RealDate(isoString);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Date = class extends RealDate {
      constructor(...args: any[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (args.length === 0) {
          super(fixed.getTime());
          return;
        }
        super(...(args as [any]));
      }
      static now() {
        return fixed.getTime();
      }
    } as typeof Date;
  }

  test('should return correct days on the 1st of a 31-day month', () => {
    mockDate('2026-03-01T10:00:00.000Z');
    // March has 31 days; next reset is April 1st = 31 days away
    expect(daysUntilFreeTierReset()).toBe(31);
  });

  test('should return 3 when exactly 3 days remain before the 1st', () => {
    // April has 30 days; April 1st is 3 days after March 29th
    mockDate('2026-03-29T00:00:00.000Z');
    expect(daysUntilFreeTierReset()).toBe(3);
  });

  test('should return 1 on the last day of a month', () => {
    mockDate('2026-03-31T23:59:59.000Z');
    expect(daysUntilFreeTierReset()).toBe(1);
  });

  test('should return 28 on the 1st of February (non-leap year)', () => {
    mockDate('2026-02-01T00:00:00.000Z');
    expect(daysUntilFreeTierReset()).toBe(28);
  });

  test('should return 29 on the 1st of February (leap year)', () => {
    mockDate('2024-02-01T00:00:00.000Z');
    expect(daysUntilFreeTierReset()).toBe(29);
  });
});
