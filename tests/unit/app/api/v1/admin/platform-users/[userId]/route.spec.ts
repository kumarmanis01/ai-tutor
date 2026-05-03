/**
 * FILE OBJECTIVE:
 * - Unit tests for platform-user management API routes (GET/PATCH/DELETE/block/unblock).
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * EDIT LOG:
 * - 2026-05-03T00:00:00Z | claude | created tests for A3.1 platform user management
 */

jest.mock('@/lib/admin/guards', () => ({
  requireActiveAdmin: jest.fn(),
  requireSuperAdmin: jest.fn(),
}));

jest.mock('@/lib/admin/authSecurity', () => ({
  extractClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    adminAuditLog: {
      create: jest.fn(),
    },
  },
}));

import { GET, PATCH, DELETE } from '@/app/api/v1/admin/platform-users/[userId]/route';
import { POST as blockPost } from '@/app/api/v1/admin/platform-users/[userId]/block/route';
import { POST as unblockPost } from '@/app/api/v1/admin/platform-users/[userId]/unblock/route';
import { requireActiveAdmin, requireSuperAdmin } from '@/lib/admin/guards';
import { prisma } from '@/lib/prisma';

const mockActiveAdmin = requireActiveAdmin as jest.MockedFunction<typeof requireActiveAdmin>;
const mockSuperAdmin = requireSuperAdmin as jest.MockedFunction<typeof requireSuperAdmin>;
const prismaMock = prisma as unknown as {
  user: { findUnique: jest.Mock; update: jest.Mock };
  adminAuditLog: { create: jest.Mock };
};

function makeParams(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

const FAKE_USER = {
  id: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  phone: null,
  grade: '10',
  board: 'cbse',
  age: 15,
  isAdult: false,
  accountStatus: 'active',
  subscriptionStatus: 'free',
  subscriptionExpiry: null,
  role: 'user',
  totalXp: 500,
  level: 3,
  currentStreak: 7,
  lastSessionDate: null,
  createdAt: new Date(),
  schoolName: null,
  subjects: [],
};

describe('GET /api/v1/admin/platform-users/[userId]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 when not authenticated', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: false });
    const res = await GET(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(403);
  });

  it('should return 404 for unknown user', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPER_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(404);
  });

  it('should return user profile for active admin', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPER_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue(FAKE_USER);
    const res = await GET(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; user: typeof FAKE_USER };
    expect(data.ok).toBe(true);
    expect(data.user.id).toBe('u1');
  });

  it('should anonymize PII for CONTENT_ADMIN', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'CONTENT_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue(FAKE_USER);
    const res = await GET(new Request('http://localhost'), makeParams('u1'));
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; user: { email: string } };
    expect(data.user.email).not.toBe('test@example.com');
  });
});

describe('PATCH /api/v1/admin/platform-users/[userId]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 for CONTENT_ADMIN', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'CONTENT_ADMIN' });
    const res = await PATCH(
      new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ name: 'New' }) }),
      makeParams('u1')
    );
    expect(res.status).toBe(403);
  });

  it('should return 404 for unknown user', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPPORT_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await PATCH(
      new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ name: 'New' }) }),
      makeParams('u1')
    );
    expect(res.status).toBe(404);
  });

  it('should update patchable fields and strip grade/board', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPPORT_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaMock.user.update.mockResolvedValue({ ...FAKE_USER, name: 'Updated' });
    prismaMock.adminAuditLog.create.mockResolvedValue({});
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated', grade: '11', board: 'icse' }),
      }),
      makeParams('u1')
    );
    expect(res.status).toBe(200);
    const updateCall = prismaMock.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data).not.toHaveProperty('grade');
    expect(updateCall.data).not.toHaveProperty('board');
    expect(updateCall.data).toHaveProperty('name', 'Updated');
  });

  it('should return 400 when no patchable fields provided', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPPORT_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    const res = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ grade: '11' }),
      }),
      makeParams('u1')
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/admin/platform-users/[userId]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 for non-super-admin', async () => {
    mockSuperAdmin.mockResolvedValue({ ok: false });
    const res = await DELETE(new Request('http://localhost', { method: 'DELETE' }), makeParams('u1'));
    expect(res.status).toBe(403);
  });

  it('should soft-delete by setting deletion_pending', async () => {
    mockSuperAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPER_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', accountStatus: 'active' });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.adminAuditLog.create.mockResolvedValue({});
    const res = await DELETE(new Request('http://localhost', { method: 'DELETE' }), makeParams('u1'));
    expect(res.status).toBe(200);
    const updateCall = prismaMock.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data).toEqual({ accountStatus: 'deletion_pending' });
  });
});

describe('POST /api/v1/admin/platform-users/[userId]/block', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 403 for CONTENT_ADMIN', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'CONTENT_ADMIN' });
    const res = await blockPost(new Request('http://localhost', { method: 'POST' }), makeParams('u1'));
    expect(res.status).toBe(403);
  });

  it('should return 409 when user already blocked', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPPORT_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', accountStatus: 'suspended' });
    const res = await blockPost(new Request('http://localhost', { method: 'POST' }), makeParams('u1'));
    expect(res.status).toBe(409);
  });

  it('should block active user', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPPORT_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', accountStatus: 'active' });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.adminAuditLog.create.mockResolvedValue({});
    const res = await blockPost(new Request('http://localhost', { method: 'POST' }), makeParams('u1'));
    expect(res.status).toBe(200);
    const updateCall = prismaMock.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data).toEqual({ accountStatus: 'suspended' });
  });
});

describe('POST /api/v1/admin/platform-users/[userId]/unblock', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 409 when user already active', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPPORT_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', accountStatus: 'active' });
    const res = await unblockPost(new Request('http://localhost', { method: 'POST' }), makeParams('u1'));
    expect(res.status).toBe(409);
  });

  it('should unblock suspended user', async () => {
    mockActiveAdmin.mockResolvedValue({ ok: true, adminUserId: 'a1', role: 'SUPPORT_ADMIN' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', accountStatus: 'suspended' });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.adminAuditLog.create.mockResolvedValue({});
    const res = await unblockPost(new Request('http://localhost', { method: 'POST' }), makeParams('u1'));
    expect(res.status).toBe(200);
    const updateCall = prismaMock.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data).toEqual({ accountStatus: 'active' });
  });
});
