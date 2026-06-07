/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/admin/auth/signup.
 * - Covers: validation, missing ADMIN_SIGNUP_CODE (503), wrong code (403),
 *   duplicate account (409), upgrade of OAuth-only account (200), and
 *   happy-path create (200).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/auth/signup/route.test.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | created -- addresses PR review request for unit coverage
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('bcryptjs', () => ({ hash: jest.fn(async () => 'hashed') }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/sessionCacheUtils', () => ({ invalidateUserSessionCache: jest.fn(async () => {}) }));

const findUnique = jest.fn();
const create = jest.fn();
const update = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: (...a: any[]) => findUnique(...a), create: (...a: any[]) => create(...a), update: (...a: any[]) => update(...a) } },
}));

function makeReq(body: any): any {
  return { json: async () => body };
}

const VALID_CODE = 'test-admin-code';

describe('POST /api/admin/auth/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_SIGNUP_CODE = VALID_CODE;
  });

  afterAll(() => {
    delete process.env.ADMIN_SIGNUP_CODE;
  });

  it('rejects invalid input with 400', async () => {
    const { POST } = await import('@/app/api/admin/auth/signup/route');
    const res = await POST(makeReq({ email: 'nope', password: 'short' }));
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 503 when ADMIN_SIGNUP_CODE is unset', async () => {
    delete process.env.ADMIN_SIGNUP_CODE;
    const { POST } = await import('@/app/api/admin/auth/signup/route');
    const res = await POST(makeReq({ email: 'a@b.com', password: 'longenough', adminCode: 'x' }));
    expect(res.status).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 403 when the admin code does not match', async () => {
    const { POST } = await import('@/app/api/admin/auth/signup/route');
    const res = await POST(makeReq({ email: 'a@b.com', password: 'longenough', adminCode: 'wrong' }));
    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 409 when a user with passwordHash already exists', async () => {
    findUnique.mockResolvedValue({ id: 'u1', role: 'admin', passwordHash: 'existing' });
    const { POST } = await import('@/app/api/admin/auth/signup/route');
    const res = await POST(makeReq({ email: 'a@b.com', password: 'longenough', adminCode: VALID_CODE }));
    expect(res.status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });

  it('upgrades an existing OAuth-only account (no passwordHash) and returns 200', async () => {
    findUnique.mockResolvedValue({ id: 'u1', role: 'user', passwordHash: null });
    update.mockResolvedValue({});
    const { POST } = await import('@/app/api/admin/auth/signup/route');
    const res = await POST(makeReq({ email: 'a@b.com', password: 'longenough', adminCode: VALID_CODE, name: 'Admin' }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'a@b.com' },
        data: expect.objectContaining({ role: 'admin', accountStatus: 'active', passwordHash: 'hashed' }),
      }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a new admin with role=admin and accountStatus=active', async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: 'u-new' });
    const { POST } = await import('@/app/api/admin/auth/signup/route');
    const res = await POST(makeReq({ email: 'a@b.com', password: 'longenough', adminCode: VALID_CODE }));
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'a@b.com',
          passwordHash: 'hashed',
          role: 'admin',
          accountStatus: 'active',
        }),
      }),
    );
  });
});
