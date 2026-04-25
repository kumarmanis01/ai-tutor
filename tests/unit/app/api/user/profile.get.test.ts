/**
 * Unit tests for GET /api/user/profile
 * Ensures student-specific fields (schoolName, currentStreak, longestStreak) are returned.
 */

describe('GET /api/user/profile', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns schoolName when present on user row', async () => {
    const savedUser = {
      id: 'u1',
      email: 'u@example.com',
      name: 'Test User',
      grade: '10',
      board: 'cbse',
      schoolName: 'Test School',
      subjects: ['mathematics'],
      age: 15,
      parentPhone: null,
      parentPhoneVerifiedAt: null,
      subscriptions: [],
      userBadges: [],
      country: 'IN',
      language: 'en',
      createdAt: null,
      role: 'student',
    };

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({ user: { email: 'u@example.com' } }),
    }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: { user: { findUnique: async () => savedUser } },
    }));

    const { GET } = await import('@/app/api/user/profile/route');
    const req = new Request('http://localhost', { method: 'GET' });
    const res: any = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schoolName).toBe('Test School');
  });

  it('returns null schoolName when missing on user row', async () => {
    const savedUser = {
      id: 'u2',
      email: 'no-school@example.com',
      name: 'No School',
      grade: null,
      board: null,
      schoolName: null,
      subjects: [],
      age: null,
      parentPhone: null,
      parentPhoneVerifiedAt: null,
      subscriptions: [],
      userBadges: [],
      country: 'IN',
      language: 'en',
      createdAt: null,
      role: 'student',
    };

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({ user: { email: 'no-school@example.com' } }),
    }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: { user: { findUnique: async () => savedUser } },
    }));

    const { GET } = await import('@/app/api/user/profile/route');
    const req = new Request('http://localhost', { method: 'GET' });
    const res: any = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schoolName).toBeNull();
  });

  it('should return currentStreak and longestStreak when present on user row', async () => {
    const savedUser = {
      id: 'u3',
      email: 'streak@example.com',
      name: 'Streak Student',
      grade: '10',
      board: 'cbse',
      schoolName: null,
      subjects: ['mathematics'],
      age: 15,
      parentPhone: null,
      parentPhoneVerifiedAt: null,
      subscriptions: [],
      userBadges: [],
      country: 'IN',
      language: 'en',
      createdAt: null,
      role: 'user',
      currentStreak: 7,
      longestStreak: 14,
      cosmeticUnlocks: ['frame_flame'],
    };

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({ user: { email: 'streak@example.com' } }),
    }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: { user: { findUnique: async () => savedUser } },
    }));

    const { GET } = await import('@/app/api/user/profile/route');
    const req = new Request('http://localhost', { method: 'GET' });
    const res: any = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentStreak).toBe(7);
    expect(body.longestStreak).toBe(14);
    expect(body.cosmeticUnlocks).toEqual(['frame_flame']);
  });

  it('should return currentStreak=0 and longestStreak=0 when streak fields absent from user row', async () => {
    const savedUser = {
      id: 'u4',
      email: 'nostreak@example.com',
      name: 'No Streak',
      grade: '9',
      board: 'icse',
      schoolName: null,
      subjects: [],
      age: 14,
      parentPhone: null,
      parentPhoneVerifiedAt: null,
      subscriptions: [],
      userBadges: [],
      country: 'IN',
      language: 'en',
      createdAt: null,
      role: 'user',
    };

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({ user: { email: 'nostreak@example.com' } }),
    }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: { user: { findUnique: async () => savedUser } },
    }));

    const { GET } = await import('@/app/api/user/profile/route');
    const req = new Request('http://localhost', { method: 'GET' });
    const res: any = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentStreak).toBe(0);
    expect(body.longestStreak).toBe(0);
    expect(body.cosmeticUnlocks).toEqual([]);
  });
});
