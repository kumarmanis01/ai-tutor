/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/admin/setup/complete/route.ts.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin setup complete tests
 * - 2026-04-27T20:05:00Z | copilot | mock decrypt/extract helpers for updated setup complete route behavior
 */

jest.mock('bcryptjs', () => ({ hash: jest.fn(async () => 'hashed') }));

jest.mock('@/lib/admin/authSecurity', () => ({
  decryptAdminMfaSecret: jest.fn((v: string) => v),
  extractClientIp: jest.fn(() => '127.0.0.1'),
  generateBackupCodes: jest.fn(() => Array.from({ length: 10 }, (_, i) => `CODE000${i}`)),
  validateAdminPassword: jest.fn(() => ({ valid: true, issues: [] })),
  verifyTotp: jest.fn(() => true),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    adminUser: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { POST } from '@/app/api/v1/admin/setup/complete/route';
import { prisma } from '@/lib/prisma';

const prismaMock = prisma as any;

describe('admin setup complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 for missing required fields', async () => {
    const res = await POST(new Request('http://localhost/api/v1/admin/setup/complete', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 for valid setup completion', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'INVITED',
      inviteExpiresAt: new Date(Date.now() + 60000),
      mfaSecret: 'SECRET',
    });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) =>
      fn({
        adminUser: { update: jest.fn() },
        adminAuditLog: { create: jest.fn() },
      })
    );

    const res = await POST(
      new Request('http://localhost/api/v1/admin/setup/complete', {
        method: 'POST',
        body: JSON.stringify({
          token: 'tok',
          password: 'StrongPass#123',
          confirmPassword: 'StrongPass#123',
          totpCode: '123456',
          backupCodesSaved: true,
        }),
      })
    );

    expect(res.status).toBe(200);
  });
});
