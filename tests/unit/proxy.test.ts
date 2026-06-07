/**
 * FILE OBJECTIVE:
 * - Unit tests for the admin guard branch of the Next.js proxy (proxy.ts).
 *   Covers:
 *   - Unauthenticated visitors to /admin -> redirect to /admin/login (UI)
 *   - Unauthenticated visitors to /api/admin/* -> 403 (API), except
 *     /api/admin/auth/* which must be reachable for bootstrap.
 *   - Authenticated non-admin visitors get the same treatment.
 *   - Admins and moderators reach protected /admin routes.
 *   - Signed-in admins on /admin/login (or any /admin auth page) are
 *     redirected to /admin.
 *   - Auth pages (login, signup, forgot-password, reset-password) are
 *     reachable without a session.
 *
 * LINKED UNIT TEST:
 * - tests/unit/proxy.test.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | created (renamed from middleware.test.ts after Next.js 16 requires us to use
 *     the proxy.ts convention rather than middleware.ts)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const getTokenMock = jest.fn();
jest.mock('next-auth/jwt', () => ({ getToken: (...a: any[]) => getTokenMock(...a) }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

function makeReq(pathname: string, method: string = 'GET'): any {
  const fullUrl = `https://example.com${pathname}`;
  return {
    method,
    url: fullUrl,
    headers: { get: () => null },
    clone() {
      return { text: async () => '' };
    },
    nextUrl: { pathname, origin: 'https://example.com' },
  };
}

describe('proxy: admin guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects unauthenticated visitors of /admin/users to /admin/login', async () => {
    getTokenMock.mockResolvedValue(null);
    const { proxy } = await import('@/proxy');
    const res = await proxy(makeReq('/admin/users'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  it('redirects authenticated non-admin visitors of /admin/users to /admin/login', async () => {
    getTokenMock.mockResolvedValue({ role: 'user' });
    const { proxy } = await import('@/proxy');
    const res = await proxy(makeReq('/admin/users'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  it('returns 403 from /api/admin/* (non-auth) for unauthenticated requests', async () => {
    getTokenMock.mockResolvedValue(null);
    const { proxy } = await import('@/proxy');
    const res = await proxy(makeReq('/api/admin/users'));
    expect(res.status).toBe(403);
  });

  it.each(['/api/admin/auth/signup', '/api/admin/auth/forgot-password', '/api/admin/auth/reset-password'])(
    'allows unauthenticated access to %s so the bootstrap flow works',
    async (path) => {
      getTokenMock.mockResolvedValue(null);
      const { proxy } = await import('@/proxy');
      const res = await proxy(makeReq(path, 'POST'));
      expect(res.status).not.toBe(403);
      expect(res.headers.get('location')).toBeNull();
    },
  );

  it('allows admins to reach protected /admin routes', async () => {
    getTokenMock.mockResolvedValue({ role: 'admin' });
    const { proxy } = await import('@/proxy');
    const res = await proxy(makeReq('/admin/users'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows moderators to reach protected /admin routes', async () => {
    getTokenMock.mockResolvedValue({ role: 'moderator' });
    const { proxy } = await import('@/proxy');
    const res = await proxy(makeReq('/admin/users'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects signed-in admins away from /admin/login back to /admin', async () => {
    getTokenMock.mockResolvedValue({ role: 'admin' });
    const { proxy } = await import('@/proxy');
    const res = await proxy(makeReq('/admin/login'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/admin$/);
  });

  it.each(['/admin/login', '/admin/signup', '/admin/forgot-password', '/admin/reset-password'])(
    'allows unauthenticated access to auth page %s',
    async (path) => {
      getTokenMock.mockResolvedValue(null);
      const { proxy } = await import('@/proxy');
      const res = await proxy(makeReq(path));
      expect(res.headers.get('location')).toBeNull();
    },
  );
});
