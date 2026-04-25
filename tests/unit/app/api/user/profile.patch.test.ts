/**
 * Unit tests for PATCH /api/user/profile
 */

describe('PATCH /api/user/profile', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('merges new crunchMode into preferences when valid', async () => {
    const session = { user: { id: 'u1' } };
    const existing = { preferences: null };

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => session }));

    const mockFindUnique = jest.fn(async () => existing);
    const mockUpdate = jest.fn(async () => ({ id: 'u1', preferences: { crunchMode: 'on' } }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: { user: { findUnique: mockFindUnique, update: mockUpdate } },
    }));

    const { PATCH } = await import('@/app/api/user/profile/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { crunchMode: 'on' } }),
    });

    const res: any = await PATCH(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.preferences).toEqual({ crunchMode: 'on' });
    expect(mockFindUnique).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { preferences: { crunchMode: 'on' } },
      select: { id: true, learningStyle: true, preferences: true },
    });
  });

  it('returns 400 for invalid crunchMode value', async () => {
    const session = { user: { id: 'u2' } };
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => session }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: { user: { findUnique: async () => ({ preferences: {} }) } },
    }));

    const { PATCH } = await import('@/app/api/user/profile/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { crunchMode: 'invalid' } }),
    });

    const res: any = await PATCH(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/crunchMode must be one of/);
  });

  it('returns 400 when nothing to update', async () => {
    const session = { user: { id: 'u3' } };
    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => session }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: { user: { findUnique: async () => ({ preferences: {} }) } },
    }));

    const { PATCH } = await import('@/app/api/user/profile/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res: any = await PATCH(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Nothing to update');
  });

  it('saves badgeShowcase when valid', async () => {
    const session = { user: { id: 'u4' } };
    const existing = { preferences: { badgeShowcase: ['a'] } };

    jest.doMock('@/lib/session', () => ({ getServerSessionForHandlers: async () => session }));

    const mockFindUnique = jest.fn(async () => existing);
    const mockUpdate = jest.fn(async () => ({
      id: 'u4',
      preferences: { badgeShowcase: ['b', 'c'] },
    }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: { user: { findUnique: mockFindUnique, update: mockUpdate } },
    }));

    const { PATCH } = await import('@/app/api/user/profile/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { badgeShowcase: ['b', 'c'] } }),
    });

    const res: any = await PATCH(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.preferences).toEqual({ badgeShowcase: ['b', 'c'] });
    expect(mockFindUnique).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'u4' },
      data: { preferences: { badgeShowcase: ['b', 'c'] } },
      select: { id: true, learningStyle: true, preferences: true },
    });
  });
});
