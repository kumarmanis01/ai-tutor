/**
 * FILE OBJECTIVE:
 * - Unit tests for the root middleware. Covers:
 *   - Non-/admin paths pass through unchanged
 *   - Unauthenticated visitors to /admin are redirected to /admin/login
 *   - Non-admin authenticated visitors to /admin are redirected to /admin/login
 *   - Signed-in admins on /admin/login (or any auth page) are redirected to /admin
 *   - Auth pages (login, signup, forgot-password, reset-password) are reachable
 *     without a session
 *
 * LINKED UNIT TEST:
 * - tests/unit/middleware.test.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | created -- addresses PR review request for unit coverage
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const getTokenMock = jest.fn();
jest.mock('next-auth/jwt', () => ({ getToken: (...a: any[]) => getTokenMock(...a) }));

function makeReq(pathname: string): any {
  const url = new URL(`https://example.com${pathname}`);
  return {
    nextUrl: {
      pathname,
      clone() {
        return new URL(url.toString());
      },
    },
  };
}

describe('middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes through non-/admin requests without checking the token', async () => {
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeReq('/dashboard'));
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated visitors of /admin to /admin/login', async () => {
    getTokenMock.mockResolvedValue(null);
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeReq('/admin'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  it('redirects authenticated non-admin visitors of /admin/users to /admin/login', async () => {
    getTokenMock.mockResolvedValue({ role: 'user' });
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeReq('/admin/users'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  it('allows admins to reach protected /admin routes', async () => {
    getTokenMock.mockResolvedValue({ role: 'admin' });
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeReq('/admin/users'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects signed-in admins away from /admin/login back to /admin', async () => {
    getTokenMock.mockResolvedValue({ role: 'admin' });
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeReq('/admin/login'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/admin$/);
  });

  it.each(['/admin/login', '/admin/signup', '/admin/forgot-password', '/admin/reset-password'])(
    'allows unauthenticated access to auth page %s',
    async (path) => {
      getTokenMock.mockResolvedValue(null);
      const { middleware } = await import('@/middleware');
      const res = await middleware(makeReq(path));
      expect(res.headers.get('location')).toBeNull();
    },
  );
});
