/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/admin/auth/reset-password.
 * - Covers: validation failure (400), missing/already-consumed token (400, P2025),
 *   non-reset identifier (400), expired token (400), non-admin target (400),
 *   happy path (200, updates passwordHash, invalidates session cache),
 *   and the atomicity contract (delete-first inside a transaction).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/auth/reset-password/route.test.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | created -- addresses PR review request for unit coverage
 *     + verifies atomic single-use token consumption (delete-first, P2025 -> invalid)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('bcryptjs', () => ({ hash: jest.fn(async () => 'new-hashed') }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
const invalidateCacheMock = jest.fn(async () => {});
jest.mock('@/lib/sessionCacheUtils', () => ({ invalidateUserSessionCache: (...a: any[]) => invalidateCacheMock(...a) }));

const tokenDelete = jest.fn();
const userFindUnique = jest.fn();
const userUpdate = jest.fn(async () => ({}));

function makeTx() {
  return {
    verificationToken: { delete: (...a: any[]) => tokenDelete(...a) },
    user: {
      findUnique: (...a: any[]) => userFindUnique(...a),
      update: (...a: any[]) => userUpdate(...a),
    },
  };
}

const transactionMock = jest.fn(async (cb: any) => cb(makeTx()));
jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: (cb: any) => transactionMock(cb) },
}));

function makeReq(body: any): any {
  return { json: async () => body };
}

const futureExpiry = () => new Date(Date.now() + 60_000);
const pastExpiry = () => new Date(Date.now() - 60_000);

describe('POST /api/admin/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects missing token or short password with 400', async () => {
    const { POST } = await import('@/app/api/admin/auth/reset-password/route');
    const res = await POST(makeReq({ token: '', password: 'short' }));
    expect(res.status).toBe(400);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the token has already been consumed (P2025 from delete)', async () => {
    tokenDelete.mockRejectedValueOnce({ code: 'P2025' });
    const { POST } = await import('@/app/api/admin/auth/reset-password/route');
    const res = await POST(makeReq({ token: 'tok', password: 'longenough' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_token');
    expect(userUpdate).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the token identifier prefix does not match the admin reset namespace', async () => {
    tokenDelete.mockResolvedValueOnce({ identifier: 'other:admin@b.com', expires: futureExpiry() });
    const { POST } = await import('@/app/api/admin/auth/reset-password/route');
    const res = await POST(makeReq({ token: 'tok', password: 'longenough' }));
    expect(res.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when the token is expired', async () => {
    tokenDelete.mockResolvedValueOnce({ identifier: 'admin-pwreset:admin@b.com', expires: pastExpiry() });
    const { POST } = await import('@/app/api/admin/auth/reset-password/route');
    const res = await POST(makeReq({ token: 'tok', password: 'longenough' }));
    expect(res.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when the target user is not an admin', async () => {
    tokenDelete.mockResolvedValueOnce({ identifier: 'admin-pwreset:admin@b.com', expires: futureExpiry() });
    userFindUnique.mockResolvedValueOnce({ id: 'u1', role: 'user' });
    const { POST } = await import('@/app/api/admin/auth/reset-password/route');
    const res = await POST(makeReq({ token: 'tok', password: 'longenough' }));
    expect(res.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('happy path: consumes the token, updates passwordHash, invalidates session cache', async () => {
    tokenDelete.mockResolvedValueOnce({ identifier: 'admin-pwreset:admin@b.com', expires: futureExpiry() });
    userFindUnique.mockResolvedValueOnce({ id: 'u1', role: 'admin' });
    const { POST } = await import('@/app/api/admin/auth/reset-password/route');
    const res = await POST(makeReq({ token: 'tok', password: 'longenough' }));
    expect(res.status).toBe(200);
    // Delete fires inside the transaction BEFORE the password update -- this
    // is the atomicity contract the PR review asked for (single-use semantics).
    expect(transactionMock).toHaveBeenCalled();
    const deleteOrder = tokenDelete.mock.invocationCallOrder[0];
    const updateOrder = userUpdate.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(updateOrder);
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'admin@b.com' },
        data: { passwordHash: 'new-hashed' },
      }),
    );
    expect(invalidateCacheMock).toHaveBeenCalledWith('admin@b.com');
  });
});
