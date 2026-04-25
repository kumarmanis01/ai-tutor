/* eslint-disable @typescript-eslint/no-var-requires */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { computeNextDeliveryUtc } from '../../../worker/services/weeklyDigestWorker';

describe('computeNextDeliveryUtc', () => {
  beforeAll(() => {
    jest.useFakeTimers('modern' as any);
    // Fixed system time for deterministic tests
    jest.setSystemTime(new Date('2026-04-07T05:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns next occurrence with correct weekday and time in UTC timezone', () => {
    const dt = computeNextDeliveryUtc('Sunday', '09:00', 'UTC');
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(
      dt
    );
    expect(weekday).toBe('Sunday');
    expect(dt.getUTCHours()).toBe(9);
    expect(dt.getUTCMinutes()).toBe(0);
    expect(dt.getTime()).toBeGreaterThan(Date.now());
  });
});
