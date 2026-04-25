import { getYearMonth } from '@/lib/student/streakShield';

describe('lib/student/streakShield', () => {
  describe('getYearMonth', () => {
    test('returns YYYY-MM for a date in January', () => {
      expect(getYearMonth(new Date('2026-01-15T12:00:00Z'))).toBe('2026-01');
    });

    test('returns YYYY-MM for a date in December', () => {
      expect(getYearMonth(new Date('2025-12-31T23:59:59Z'))).toBe('2025-12');
    });

    test('pads single-digit months with a leading zero', () => {
      expect(getYearMonth(new Date('2026-03-01T00:00:00Z'))).toBe('2026-03');
    });

    test('is pure — same input gives same output', () => {
      const d = new Date('2026-06-15T08:00:00Z');
      expect(getYearMonth(d)).toBe('2026-06');
      expect(getYearMonth(d)).toBe('2026-06');
    });
  });
});

// -- isShieldAvailable and consumeShield behaviour tests ---------------------

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('isShieldAvailable', () => {
  const NOW = new Date('2026-04-14T10:00:00Z');

  beforeEach(() => {
    jest.resetModules();
  });

  it('returns true when the Redis shield key is absent', async () => {
    jest.mock('@/lib/redis', () => ({
      getRedis: () => ({ get: jest.fn(async () => null), set: jest.fn() }),
    }));

    const { isShieldAvailable } = await import('@/lib/student/streakShield');
    await expect(isShieldAvailable('student-1', NOW)).resolves.toBe(true);
  });

  it('returns false when the Redis shield key is present', async () => {
    jest.mock('@/lib/redis', () => ({
      getRedis: () => ({ get: jest.fn(async () => '1'), set: jest.fn() }),
    }));

    const { isShieldAvailable } = await import('@/lib/student/streakShield');
    await expect(isShieldAvailable('student-1', NOW)).resolves.toBe(false);
  });

  it('returns false (safe fallback) when Redis throws', async () => {
    jest.mock('@/lib/redis', () => ({
      getRedis: () => ({
        get: jest.fn(async () => {
          throw new Error('Redis timeout');
        }),
        set: jest.fn(),
      }),
    }));

    const { isShieldAvailable } = await import('@/lib/student/streakShield');
    await expect(isShieldAvailable('student-1', NOW)).resolves.toBe(false);
  });

  it('returns false when Redis is unavailable (getRedis returns null)', async () => {
    jest.mock('@/lib/redis', () => ({ getRedis: () => null }));

    const { isShieldAvailable } = await import('@/lib/student/streakShield');
    await expect(isShieldAvailable('student-1', NOW)).resolves.toBe(false);
  });
});

describe('consumeShield', () => {
  const NOW = new Date('2026-04-14T10:00:00Z');

  beforeEach(() => {
    jest.resetModules();
  });

  it('writes the shield key with the correct pattern and an EX TTL', async () => {
    const setMock = jest.fn(async () => 'OK');
    jest.mock('@/lib/redis', () => ({
      getRedis: () => ({ get: jest.fn(async () => null), set: setMock }),
    }));

    const { consumeShield } = await import('@/lib/student/streakShield');
    const result = await consumeShield('student-2', NOW);

    expect(result).toBe(true);
    // Key must follow the documented pattern: streak:shield:used:{studentId}:{YYYY-MM}
    expect(setMock).toHaveBeenCalledWith(
      'streak:shield:used:student-2:2026-04',
      '1',
      'EX',
      expect.any(Number)
    );
    // TTL must be positive
    const ttl = setMock.mock.calls[0][3] as number;
    expect(ttl).toBeGreaterThan(0);
  });

  it('is idempotent -- calling twice both succeed without error', async () => {
    const setMock = jest.fn(async () => 'OK');
    jest.mock('@/lib/redis', () => ({
      getRedis: () => ({ get: jest.fn(async () => null), set: setMock }),
    }));

    const { consumeShield } = await import('@/lib/student/streakShield');
    const r1 = await consumeShield('student-3', NOW);
    const r2 = await consumeShield('student-3', NOW);

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(setMock).toHaveBeenCalledTimes(2);
  });

  it('returns false when Redis throws', async () => {
    jest.mock('@/lib/redis', () => ({
      getRedis: () => ({
        set: jest.fn(async () => {
          throw new Error('connection refused');
        }),
      }),
    }));

    const { consumeShield } = await import('@/lib/student/streakShield');
    await expect(consumeShield('student-4', NOW)).resolves.toBe(false);
  });

  it('returns false when Redis is unavailable (getRedis returns null)', async () => {
    jest.mock('@/lib/redis', () => ({ getRedis: () => null }));

    const { consumeShield } = await import('@/lib/student/streakShield');
    await expect(consumeShield('student-4', NOW)).resolves.toBe(false);
  });
});
