/**
 * FILE OBJECTIVE:
 * - Unit tests for app/api/v1/admin/users/route.ts.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin users route tests
 */

jest.mock('@/lib/admin/guards', () => ({
  requireSuperAdmin: jest.fn(),
}));

jest.mock('@/lib/mailer', () => ({
  sendAdminInvite: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    adminUser: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { GET, POST } from '@/app/api/v1/admin/users/route';
import { requireSuperAdmin } from '@/lib/admin/guards';
import { prisma } from '@/lib/prisma';

const mockRequireSuperAdmin = requireSuperAdmin as jest.MockedFunction<typeof requireSuperAdmin>;
const prismaMock = prisma as unknown as {
  user: { findUnique: jest.Mock };
  adminUser: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('v1 admin users route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET should return 403 for non-super-admin', async () => {
    mockRequireSuperAdmin.mockResolvedValue({ ok: false });
    const res = await GET(new Request('http://localhost/api/v1/admin/users'));
    expect(res.status).toBe(403);
  });

  it('POST should reject free email domains', async () => {
    mockRequireSuperAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPER_ADMIN' });
    const res = await POST(
      new Request('http://localhost/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: 'x@gmail.com', name: 'Admin Name', role: 'SUPPORT_ADMIN' }),
      })
    );
    expect(res.status).toBe(400);
  });

  it('POST should create invite when payload is valid', async () => {
    mockRequireSuperAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPER_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) =>
      fn({
        user: {
          create: jest.fn().mockResolvedValue({ id: 'u1', email: 'admin@corp.com', name: 'Admin Name' }),
        },
        adminUser: {
          upsert: jest.fn().mockResolvedValue({
            id: 'ad1',
            role: 'SUPPORT_ADMIN',
            status: 'INVITED',
            inviteExpiresAt: new Date(),
          }),
        },
        adminAuditLog: {
          create: jest.fn().mockResolvedValue({ id: 'log1' }),
        },
      })
    );

    const res = await POST(
      new Request('http://localhost/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@corp.com', name: 'Admin Name', role: 'SUPPORT_ADMIN' }),
      })
    );

    expect(res.status).toBe(200);
  });
});
