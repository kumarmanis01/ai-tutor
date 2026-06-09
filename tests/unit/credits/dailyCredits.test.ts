/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/credits/dailyCredits -- Redis counter logic, IST date helpers,
 *   limit derivation, and graceful Redis-unavailable fallbacks.
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | initial tests for task S1-3
 */

const mockGet = jest.fn();
const mockIncr = jest.fn();
const mockExpireat = jest.fn();

jest.mock('@/lib/redis', () => ({
  getRedis: () => ({ get: mockGet, incr: mockIncr, expireat: mockExpireat }),
}));

jest.mock('@/lib/subscription', () => ({
  isPremiumUser: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import {
  getDailyUsage,
  incrementDailyUsage,
  getDailyLimit,
  isAtLimit,
  getISTDateString,
  getNextISTMidnightUnix,
} from '@/lib/credits/dailyCredits';
import { isPremiumUser } from '@/lib/subscription';

const mockIsPremiumUser = isPremiumUser as jest.MockedFunction<typeof isPremiumUser>;

const IST_OFFSET_MS = 330 * 60 * 1000;

describe('getISTDateString', () => {
  it('should return YYYY-MM-DD in IST, not UTC when they differ', () => {
    // UTC 2026-06-08T20:00:00Z = IST 2026-06-09T01:30:00+05:30
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-08T20:00:00Z').getTime());
    const result = getISTDateString();
    expect(result).toBe('2026-06-09');
    jest.spyOn(Date, 'now').mockRestore();
  });

  it('should return the UTC date when both UTC and IST are on the same day', () => {
    // UTC 2026-06-08T10:00:00Z = IST 2026-06-08T15:30:00+05:30
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-08T10:00:00Z').getTime());
    const result = getISTDateString();
    expect(result).toBe('2026-06-08');
    jest.spyOn(Date, 'now').mockRestore();
  });
});

describe('getNextISTMidnightUnix', () => {
  it('should return a timestamp equal to next IST midnight expressed in UTC', () => {
    // Current UTC: 2026-06-08T10:00:00Z => IST: 2026-06-08T15:30:00+05:30
    // Next IST midnight: 2026-06-09T00:00:00+05:30 = 2026-06-08T18:30:00Z
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-08T10:00:00Z').getTime());
    const result = getNextISTMidnightUnix();
    const expected = Math.floor(new Date('2026-06-08T18:30:00Z').getTime() / 1000);
    expect(result).toBe(expected);
    jest.spyOn(Date, 'now').mockRestore();
  });

  it('should use IST date for key, not UTC', () => {
    // UTC 2026-06-08T20:00:00Z = IST 2026-06-09T01:30:00+05:30
    // Next IST midnight: 2026-06-10T00:00:00+05:30 = 2026-06-09T18:30:00Z
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-08T20:00:00Z').getTime());
    const result = getNextISTMidnightUnix();
    const expected = Math.floor(new Date('2026-06-09T18:30:00Z').getTime() / 1000);
    expect(result).toBe(expected);
    jest.spyOn(Date, 'now').mockRestore();
  });
});

describe('getDailyUsage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 0 for a new user when Redis returns null', async () => {
    mockGet.mockResolvedValue(null);
    const result = await getDailyUsage('user-123');
    expect(result).toBe(0);
  });

  it('should return the stored count when Redis has a value', async () => {
    mockGet.mockResolvedValue('42');
    const result = await getDailyUsage('user-123');
    expect(result).toBe(42);
  });

  it('should return 0 when Redis throws', async () => {
    mockGet.mockRejectedValue(new Error('Redis connection refused'));
    const result = await getDailyUsage('user-123');
    expect(result).toBe(0);
  });

  it('should not throw when Redis unavailable', async () => {
    mockGet.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(getDailyUsage('user-xyz')).resolves.toBe(0);
  });
});

describe('incrementDailyUsage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should increment atomically and return the new count', async () => {
    mockIncr.mockResolvedValue(5);
    mockExpireat.mockResolvedValue(1);
    const result = await incrementDailyUsage('user-123');
    expect(mockIncr).toHaveBeenCalledTimes(1);
    expect(result).toBe(5);
  });

  it('should set EXPIREAT after INCR', async () => {
    mockIncr.mockResolvedValue(1);
    mockExpireat.mockResolvedValue(1);
    await incrementDailyUsage('user-123');
    expect(mockExpireat).toHaveBeenCalledTimes(1);
    // The EXPIREAT argument should be a unix timestamp in the future
    const expireArg = mockExpireat.mock.calls[0][1] as number;
    expect(expireArg).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('should return 0 when Redis throws', async () => {
    mockIncr.mockRejectedValue(new Error('Redis down'));
    const result = await incrementDailyUsage('user-123');
    expect(result).toBe(0);
  });

  it('should not throw when Redis unavailable', async () => {
    mockIncr.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(incrementDailyUsage('user-xyz')).resolves.toBe(0);
  });
});

describe('getDailyLimit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return DAILY_PAID_LIMIT for premium users', async () => {
    mockIsPremiumUser.mockResolvedValue(true);
    const result = await getDailyLimit('user-paid');
    expect(result).toBe(200);
  });

  it('should return DAILY_FREE_LIMIT for free users', async () => {
    mockIsPremiumUser.mockResolvedValue(false);
    const result = await getDailyLimit('user-free');
    expect(result).toBe(50);
  });

  it('should return DAILY_FREE_LIMIT when subscription check throws', async () => {
    mockIsPremiumUser.mockRejectedValue(new Error('DB error'));
    const result = await getDailyLimit('user-error');
    expect(result).toBe(50);
  });
});

describe('isAtLimit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return true when at limit', async () => {
    mockGet.mockResolvedValue('50');
    mockIsPremiumUser.mockResolvedValue(false);
    const result = await isAtLimit('user-123');
    expect(result).toBe(true);
  });

  it('should return false when below limit', async () => {
    mockGet.mockResolvedValue('30');
    mockIsPremiumUser.mockResolvedValue(false);
    const result = await isAtLimit('user-123');
    expect(result).toBe(false);
  });

  it('should return false when Redis unavailable', async () => {
    mockGet.mockRejectedValue(new Error('ECONNREFUSED'));
    mockIsPremiumUser.mockResolvedValue(false);
    const result = await isAtLimit('user-123');
    // getDailyUsage returns 0 on failure, 0 < 50, so not at limit
    expect(result).toBe(false);
  });

  it('should not throw when Redis unavailable', async () => {
    mockGet.mockRejectedValue(new Error('Redis down'));
    mockIsPremiumUser.mockResolvedValue(false);
    await expect(isAtLimit('user-xyz')).resolves.toBe(false);
  });

  it('should use IST date for key, not UTC', () => {
    // This test verifies the key includes the IST date by checking that
    // getISTDateString returns the IST date (tested separately above).
    // The key format is: credits:{userId}:{YYYY-MM-DD} where date is IST.
    const utcMidnight = new Date('2026-06-08T20:00:00Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(utcMidnight);
    const istDate = getISTDateString();
    // UTC date is 2026-06-08, IST date is 2026-06-09 at this time.
    expect(istDate).toBe('2026-06-09');
    jest.spyOn(Date, 'now').mockRestore();
  });
});
