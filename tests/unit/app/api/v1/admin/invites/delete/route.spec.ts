/**
 * FILE OBJECTIVE:
 * - Unit tests for DELETE /api/v1/admin/invites/:id soft-delete route.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:21:00Z | copilot | created soft-delete route tests for admin invites
 */

jest.mock('@/lib/admin/guards', () => ({
  requireSuperAdmin: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    adminUser: { update: jest.fn() },
    adminTrustedDevice: { deleteMany: jest.fn() },
    adminSession: { updateMany: jest.fn() },
    adminAuditLog: { create: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import { DELETE } from '@/app/api/v1/admin/invites/[id]/route';
import { requireSuperAdmin } from '@/lib/admin/guards';

const guardMock = requireSuperAdmin as jest.MockedFunction<typeof requireSuperAdmin>;

describe('admin invites delete route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 for non-super-admin', async () => {
    guardMock.mockResolvedValue({ ok: false });
    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(403);
  });

  it('returns 200 for valid soft-delete', async () => {
    guardMock.mockResolvedValue({ ok: true, adminUserId: 's1', role: 'SUPER_ADMIN', userId: 'u1' });
    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(200);
  });
});
