/**
 * GROUP 2: Integration tests for the student session flow.
 * Covers freemium caps, consent gate, streak update, and streak shield.
 * All external services mocked — no live DB or network calls.
 */

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------
const prismaMock = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  freeTierUsage: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  consent: {
    findFirst: jest.fn(),
  },
  subscription: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logAPI: jest.fn(),
  },
}));

const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  setex: jest.fn(),
};
jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn().mockReturnValue(redisMock),
}));

jest.mock('@/lib/subscription', () => ({
  isPremiumUser: jest.fn().mockResolvedValue(false),
}));

// ---------------------------------------------------------------------------
// Module imports
// ---------------------------------------------------------------------------
import { checkFreeTierCap, FREE_TIER_SESSION_LIMIT } from '@/lib/freemium';
import { hasConsented, ConsentScope } from '@/lib/consent/check';
import { updateStreak, classifyStreakGap } from '@/lib/student/streak';
import { enforceTutorFreemiumCap } from '@/services/tutor/turn';
import { isPremiumUser } from '@/lib/subscription';

beforeEach(() => {
  jest.clearAllMocks();
  (isPremiumUser as jest.Mock).mockResolvedValue(false);
});

// ---------------------------------------------------------------------------
// 1. Freemium session cap
// ---------------------------------------------------------------------------
describe('Freemium session cap', () => {
  it('returns allowed:false when sessionsUsed >= FREE_TIER_SESSION_LIMIT', async () => {
    prismaMock.freeTierUsage.findUnique.mockResolvedValueOnce({
      studentId: 'student-1',
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      sessionsUsed: FREE_TIER_SESSION_LIMIT,
    });

    const result = await checkFreeTierCap('student-1');
    expect(result.allowed).toBe(false);
    expect(result.sessionsRemaining).toBe(0);
  });

  it('returns allowed:true when sessionsUsed < FREE_TIER_SESSION_LIMIT', async () => {
    prismaMock.freeTierUsage.findUnique.mockResolvedValueOnce({
      studentId: 'student-2',
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      sessionsUsed: 2,
    });

    const result = await checkFreeTierCap('student-2');
    expect(result.allowed).toBe(true);
    expect(result.sessionsUsed).toBe(2);
    expect(result.sessionsRemaining).toBe(FREE_TIER_SESSION_LIMIT - 2);
  });

  it('returns allowed:true for premium users (bypasses cap)', async () => {
    (isPremiumUser as jest.Mock).mockResolvedValueOnce(true);
    const result = await checkFreeTierCap('premium-student');
    expect(result.allowed).toBe(true);
    // Premium users skip freeTierUsage lookup entirely
    expect(prismaMock.freeTierUsage.findUnique).not.toHaveBeenCalled();
  });

  it('creates new FreeTierUsage when none exists', async () => {
    prismaMock.freeTierUsage.findUnique.mockResolvedValueOnce(null);
    prismaMock.freeTierUsage.create.mockResolvedValueOnce({
      studentId: 'student-new',
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      sessionsUsed: 0,
    });

    const result = await checkFreeTierCap('student-new');
    expect(result.allowed).toBe(true);
    expect(result.sessionsUsed).toBe(0);
  });

  describe('enforceTutorFreemiumCap() — daily free questions', () => {
    it('throws RATE_LIMITED when todaysFreeQuestionsCount is 0', async () => {
      (isPremiumUser as jest.Mock).mockResolvedValueOnce(false);
      prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
        const txMock = {
          user: {
            findUnique: jest.fn().mockResolvedValueOnce({ todaysFreeQuestionsCount: 0 }),
            update: jest.fn(),
          },
        };
        return fn(txMock);
      });

      await expect(enforceTutorFreemiumCap('student-capped')).rejects.toMatchObject({
        code: 'RATE_LIMITED',
      });
    });

    it('succeeds when todaysFreeQuestionsCount > 0', async () => {
      (isPremiumUser as jest.Mock).mockResolvedValueOnce(false);
      prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
        const txMock = {
          user: {
            findUnique: jest.fn().mockResolvedValueOnce({ todaysFreeQuestionsCount: 3 }),
            update: jest.fn().mockResolvedValueOnce({}),
          },
        };
        return fn(txMock);
      });

      await expect(enforceTutorFreemiumCap('student-ok')).resolves.toBeUndefined();
    });

    it('does not check cap for premium users', async () => {
      (isPremiumUser as jest.Mock).mockResolvedValueOnce(true);
      await expect(enforceTutorFreemiumCap('premium-student')).resolves.toBeUndefined();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Consent gate — hasConsented()
// ---------------------------------------------------------------------------
describe('Consent gate', () => {
  it('returns false when no AI_INTERACTION consent record exists', async () => {
    prismaMock.consent.findFirst.mockResolvedValueOnce(null);
    const result = await hasConsented('student-no-consent', ConsentScope.AI_INTERACTION);
    expect(result).toBe(false);
    expect(prismaMock.consent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'student-no-consent',
          scope: ConsentScope.AI_INTERACTION,
          withdrawnAt: null,
        }),
      })
    );
  });

  it('returns true when valid non-withdrawn AI_INTERACTION consent exists', async () => {
    prismaMock.consent.findFirst.mockResolvedValueOnce({ id: 'consent-1' });
    const result = await hasConsented('student-consented', ConsentScope.AI_INTERACTION);
    expect(result).toBe(true);
  });

  it('returns false when consent exists but is withdrawn (withdrawnAt set)', async () => {
    // hasConsented() queries WHERE withdrawnAt IS NULL, so withdrawn consent returns null
    prismaMock.consent.findFirst.mockResolvedValueOnce(null);
    const result = await hasConsented('student-withdrawn', ConsentScope.AI_INTERACTION);
    expect(result).toBe(false);
  });

  it('returns false on DB error', async () => {
    prismaMock.consent.findFirst.mockRejectedValueOnce(new Error('db error'));
    const result = await hasConsented('student-err', ConsentScope.AI_INTERACTION);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Session completion + streak — classifyStreakGap() (pure) + updateStreak()
// ---------------------------------------------------------------------------
describe('classifyStreakGap() — pure function', () => {
  it("returns 'broken' when lastSessionDate is null", () => {
    expect(classifyStreakGap(null, new Date())).toBe('broken');
  });

  it("returns 'same_day' when lastSessionDate is today", () => {
    const today = new Date('2026-03-16T10:00:00Z');
    const lastSession = new Date('2026-03-16T05:00:00Z');
    expect(classifyStreakGap(lastSession, today)).toBe('same_day');
  });

  it("returns 'consecutive' when lastSessionDate is yesterday", () => {
    const today = new Date('2026-03-16T10:00:00Z');
    const yesterday = new Date('2026-03-15T10:00:00Z');
    expect(classifyStreakGap(yesterday, today)).toBe('consecutive');
  });

  it("returns 'broken' when lastSessionDate is 2+ days ago", () => {
    const today = new Date('2026-03-16T10:00:00Z');
    const twoDaysAgo = new Date('2026-03-14T10:00:00Z');
    expect(classifyStreakGap(twoDaysAgo, today)).toBe('broken');
  });
});

describe('updateStreak()', () => {
  it('increments streak when session is on consecutive day', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      lastSessionDate: yesterday,
      currentStreak: 5,
      longestStreak: 7,
    });
    prismaMock.user.update.mockResolvedValueOnce({
      currentStreak: 6,
      longestStreak: 7,
      lastSessionDate: new Date(),
    });

    const result = await updateStreak('student-streak-1');
    expect(result).not.toBeNull();
    expect(result!.currentStreak).toBe(6);
    expect(result!.streakIncremented).toBe(true);
  });

  it('does NOT double-increment when updateStreak is called twice on the same calendar day', async () => {
    const today = new Date();
    // Both calls return lastSessionDate = today → same_day → no increment
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ lastSessionDate: today, currentStreak: 3, longestStreak: 3 })
      .mockResolvedValueOnce({ lastSessionDate: today, currentStreak: 3, longestStreak: 3 });
    prismaMock.user.update.mockResolvedValue({
      currentStreak: 3,
      longestStreak: 3,
      lastSessionDate: today,
    });

    const result1 = await updateStreak('student-streak-2');
    const result2 = await updateStreak('student-streak-2');

    expect(result1!.streakIncremented).toBe(false);
    expect(result2!.streakIncremented).toBe(false);
    // currentStreak stays at 3 for both calls
    expect(result1!.currentStreak).toBe(3);
    expect(result2!.currentStreak).toBe(3);
  });

  it('resets streak to 1 when gap > 1 day (broken streak)', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      lastSessionDate: threeDaysAgo,
      currentStreak: 5,
      longestStreak: 10,
    });
    prismaMock.user.update.mockResolvedValueOnce({
      currentStreak: 1,
      longestStreak: 10,
      lastSessionDate: new Date(),
    });

    const result = await updateStreak('student-streak-3');
    expect(result).not.toBeNull();
    expect(result!.currentStreak).toBe(1);
    expect(result!.streakIncremented).toBe(true);
  });

  it('updates longestStreak when currentStreak exceeds it', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      lastSessionDate: yesterday,
      currentStreak: 9,
      longestStreak: 9,
    });
    prismaMock.user.update.mockResolvedValueOnce({
      currentStreak: 10,
      longestStreak: 10,
      lastSessionDate: new Date(),
    });

    const result = await updateStreak('student-streak-4');
    expect(result!.longestStreak).toBe(10);
    expect(result!.currentStreak).toBe(10);
  });

  it('returns null when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const result = await updateStreak('ghost-student');
    expect(result).toBeNull();
  });

  it('returns null on DB error', async () => {
    prismaMock.user.findUnique.mockRejectedValueOnce(new Error('db error'));
    const result = await updateStreak('student-err');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Streak shield — not yet implemented
// ---------------------------------------------------------------------------
describe('Streak shield', () => {
  test.todo(
    'GIVEN streak=5 and no shield used WHEN missed day THEN streak preserved (shield consumed)'
  );
  test.todo('GIVEN shield already consumed WHEN another missed day THEN streak breaks');
});
