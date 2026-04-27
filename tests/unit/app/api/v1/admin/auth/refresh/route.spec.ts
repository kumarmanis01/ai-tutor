/**
 * FILE OBJECTIVE:
 * - Unit tests for admin refresh route token rotation behavior.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:20:00Z | copilot | created tests for /api/v1/admin/auth/refresh route
 */

jest.mock('@/lib/auth/blacklist.service', () => ({
  blacklistToken: jest.fn(),
  isBlacklisted: jest.fn(),
}));

jest.mock('@/lib/auth/token.service', () => ({
  verifyAdminRefreshToken: jest.fn(),
  generateTokenPair: jest.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {},
  TokenInvalidError: class TokenInvalidError extends Error {},
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    adminSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    adminUser: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import { POST } from '@/app/api/v1/admin/auth/refresh/route';
import { isBlacklisted } from '@/lib/auth/blacklist.service';
import { generateTokenPair, verifyAdminRefreshToken } from '@/lib/auth/token.service';
import { prisma } from '@/lib/prisma';

const prismaMock = prisma as unknown as {
  adminSession: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
  adminUser: { findFirst: jest.Mock };
};

describe('admin auth refresh route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when refresh token is missing', async () => {
    const res = await POST(new Request('http://localhost/api/v1/admin/auth/refresh', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(400);
  });

  it('returns new token pair on valid session', async () => {
    (verifyAdminRefreshToken as jest.Mock).mockResolvedValue({ sub: 'u1', role: 'SUPER_ADMIN', scope: 'admin', jti: 'j1', exp: Math.floor(Date.now()/1000)+1000 });
    (isBlacklisted as jest.Mock).mockResolvedValue(false);
    prismaMock.adminSession.findUnique.mockResolvedValue({ adminId: 'a1', refreshToken: 'old', expiresAt: new Date(Date.now() + 10000), revokedAt: null, ipAddress: '1.1.1.1', userAgent: 'ua' });
    prismaMock.adminUser.findFirst.mockResolvedValue({ id: 'a1', role: 'SUPER_ADMIN', status: 'ACTIVE', user: { id: 'u1' } });
    (generateTokenPair as jest.Mock).mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' });
    prismaMock.adminSession.update.mockResolvedValue({});
    prismaMock.adminSession.create.mockResolvedValue({});

    const res = await POST(new Request('http://localhost/api/v1/admin/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: 'old' }) }));
    expect(res.status).toBe(200);
  });
});
