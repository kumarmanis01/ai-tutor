/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/admin/auth/forgot-password.
 * - Covers: invalid email (200, silent), unknown user (200, silent, no token issued),
 *   non-admin user (200, silent, no token issued), admin user (200, token issued + email sent),
 *   and that the reset URL falls back to PRODUCTION_BASE_URL when NEXTAUTH_URL is unset.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/auth/forgot-password/route.test.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | created -- addresses PR review request for unit coverage
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const sendEmailMock = jest.fn(async () => undefined);
jest.mock('@/lib/mail', () => ({ sendEmailUnifiedSafe: (...a: any[]) => sendEmailMock(...a) }));
jest.mock('@/lib/email/templates', () => ({ magicLinkHtml: (url: string) => `<a href="${url}">x</a>` }));

const userFindUnique = jest.fn();
const verificationTokenCreate = jest.fn(async () => ({}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: (...a: any[]) => userFindUnique(...a) },
    verificationToken: { create: (...a: any[]) => verificationTokenCreate(...a) },
  },
}));

function makeReq(body: any): any {
  return { json: async () => body };
}

describe('POST /api/admin/auth/forgot-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXTAUTH_URL;
  });

  it('returns 200 and is a no-op on invalid email', async () => {
    const { POST } = await import('@/app/api/admin/auth/forgot-password/route');
    const res = await POST(makeReq({ email: 'not-an-email' }));
    expect(res.status).toBe(200);
    expect(verificationTokenCreate).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('returns 200 and does not issue a token for unknown users', async () => {
    userFindUnique.mockResolvedValue(null);
    const { POST } = await import('@/app/api/admin/auth/forgot-password/route');
    const res = await POST(makeReq({ email: 'noone@b.com' }));
    expect(res.status).toBe(200);
    expect(verificationTokenCreate).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('returns 200 and does not issue a token for non-admin users', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', role: 'user', name: null });
    const { POST } = await import('@/app/api/admin/auth/forgot-password/route');
    const res = await POST(makeReq({ email: 'student@b.com' }));
    expect(res.status).toBe(200);
    expect(verificationTokenCreate).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('issues a token and sends an absolute reset URL using PRODUCTION_BASE_URL when NEXTAUTH_URL is unset', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', role: 'admin', name: 'A' });
    const { POST } = await import('@/app/api/admin/auth/forgot-password/route');
    const res = await POST(makeReq({ email: 'admin@b.com' }));
    expect(res.status).toBe(200);
    expect(verificationTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ identifier: 'admin-pwreset:admin@b.com' }),
      }),
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const html = sendEmailMock.mock.calls[0][0].html as string;
    expect(html).toContain('https://spinzyacademy.com/admin/reset-password?token=');
  });

  it('uses NEXTAUTH_URL when set', async () => {
    process.env.NEXTAUTH_URL = 'https://admin.example.com/';
    userFindUnique.mockResolvedValue({ id: 'u1', role: 'admin', name: 'A' });
    const { POST } = await import('@/app/api/admin/auth/forgot-password/route');
    await POST(makeReq({ email: 'admin@b.com' }));
    const html = sendEmailMock.mock.calls[0][0].html as string;
    expect(html).toContain('https://admin.example.com/admin/reset-password?token=');
    expect(html).not.toContain('//admin/reset-password');
  });
});
