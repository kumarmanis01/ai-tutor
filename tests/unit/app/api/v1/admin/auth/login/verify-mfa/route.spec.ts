/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/admin/auth/login/verify-mfa/route.ts.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin login verify-mfa tests
 * - 2026-04-27T20:05:00Z | copilot | add mocks for decrypt and AdminSession persistence in updated MFA flow
 */

jest.mock('@/lib/admin/authSecurity', () => ({
  verifyAdminLoginSessionToken: jest.fn(),
  verifyTotp: jest.fn(),
  decryptAdminMfaSecret: jest.fn((v: string) => v),
  signAdminDeviceToken: jest.fn(async () => 'device-token'),
  extractClientIp: jest.fn(() => '127.0.0.1'),
  toIpv4Subnet24: jest.fn(() => '127.0.0.0/24'),
  computeTrustedDeviceHash: jest.fn(() => 'hash-device'),
}));

jest.mock('@/lib/auth/token.service', () => ({
  generateTokenPair: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    adminUser: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    adminTrustedDevice: {
      upsert: jest.fn(),
    },
    adminAuditLog: {
      create: jest.fn(),
    },
    adminSession: {
      create: jest.fn(),
    },
  },
}));

import { POST } from '@/app/api/v1/admin/auth/login/verify-mfa/route';
import { verifyAdminLoginSessionToken, verifyTotp } from '@/lib/admin/authSecurity';
import { generateTokenPair } from '@/lib/auth/token.service';
import { prisma } from '@/lib/prisma';

const mockVerifySession = verifyAdminLoginSessionToken as jest.MockedFunction<
  typeof verifyAdminLoginSessionToken
>;
const mockVerifyTotp = verifyTotp as jest.MockedFunction<typeof verifyTotp>;
const mockGeneratePair = generateTokenPair as jest.MockedFunction<typeof generateTokenPair>;
const prismaMock = prisma as unknown as {
  adminUser: { findUnique: jest.Mock; update: jest.Mock };
  adminTrustedDevice: { upsert: jest.Mock };
  adminAuditLog: { create: jest.Mock };
  adminSession: { create: jest.Mock };
};

describe('admin login verify-mfa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_JWT_ACCESS_SECRET = 'test-secret-admin-access';
  });

  it('should return 400 when login session token is missing', async () => {
    const res = await POST(new Request('http://localhost/api/v1/admin/auth/login/verify-mfa', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(400);
  });

  it('should return tokens on valid MFA verification', async () => {
    mockVerifySession.mockResolvedValue({ adminUserId: 'a1', role: 'SUPPORT_ADMIN', type: 'admin_login_session' });
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'ACTIVE',
      role: 'SUPPORT_ADMIN',
      mfaSecret: 'SECRET',
      mfaBackupCodes: null,
      user: { id: 'u1' },
    });
    mockVerifyTotp.mockReturnValue(true);
    mockGeneratePair.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

    const res = await POST(
      new Request('http://localhost/api/v1/admin/auth/login/verify-mfa', {
        method: 'POST',
        body: JSON.stringify({ loginSessionToken: 'session', totpCode: '123456', rememberDevice: true }),
      })
    );

    expect(res.status).toBe(200);
  });
});
