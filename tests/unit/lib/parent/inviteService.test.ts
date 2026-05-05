/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() },
}));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../../../helpers/prismaMock';
import {
  createOrReuseParentInviteForStudent,
  linkParentToStudentByEmail,
  redeemParentInviteAndLink,
} from '@/lib/parent/inviteService';

describe('inviteService', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('reuses an existing pending invite', async () => {
    prismaMock.parentInvite.findFirst.mockResolvedValue({
      code: 'ABCD1234',
      expiresAt: new Date('2026-03-10T00:00:00Z'),
    });

    const res = await createOrReuseParentInviteForStudent({ prisma: prismaMock as any, studentId: 'stu-1', now: new Date('2026-03-03T00:00:00Z') });
    expect(res.code).toBe('ABCD1234');
  });

  it('creates a new pending invite when none exists', async () => {
    prismaMock.parentInvite.findFirst.mockResolvedValue(null);
    prismaMock.parentInvite.findUnique.mockResolvedValue(null);
    prismaMock.parentInvite.create.mockResolvedValue({
      code: 'FFFFEEEE',
      expiresAt: new Date('2026-03-10T00:00:00Z'),
    });

    const res = await createOrReuseParentInviteForStudent({ prisma: prismaMock as any, studentId: 'stu-1', now: new Date('2026-03-03T00:00:00Z') });
    expect(res.code).toBe('FFFFEEEE');
    expect(prismaMock.parentInvite.create).toHaveBeenCalled();
  });

  it('email linking requires student.parentEmail to match parent', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'stu-1', parentEmail: 'mom@example.com' });
    prismaMock.parentStudent.findUnique.mockResolvedValue(null);
    prismaMock.parentStudent.count.mockResolvedValue(0);
    prismaMock.parentStudent.create.mockResolvedValue({ id: 'ps-1' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: 'stu-1', parentEmail: 'mom@example.com' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'user' });

    const ok = await linkParentToStudentByEmail({
      prisma: prismaMock as any,
      parentId: 'par-1',
      parentEmail: 'mom@example.com',
      studentEmail: 'child@example.com',
      relationship: 'mother',
    });
    expect(ok.studentId).toBe('stu-1');
    expect(prismaMock.parentStudent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ relationship: 'mother' }) }),
    );
  });

  it('email linking rejects when parent already has max active children', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'stu-1', parentEmail: 'mom@example.com' });
    prismaMock.parentStudent.findUnique.mockResolvedValue(null);
    prismaMock.parentStudent.count.mockResolvedValue(3);

    await expect(
      linkParentToStudentByEmail({
        prisma: prismaMock as any,
        parentId: 'par-1',
        parentEmail: 'mom@example.com',
        studentEmail: 'child@example.com',
        relationship: 'guardian',
      }),
    ).rejects.toThrow('maximum linked children');
  });

  it('redeems invite and links parent (already linked case)', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));

    prismaMock.parentInvite.findUnique.mockResolvedValue({
      id: 'inv-1',
      studentId: 'stu-1',
      status: 'pending',
      expiresAt: new Date('2026-03-10T00:00:00Z'),
    });
    prismaMock.parentStudent.findUnique.mockResolvedValue({ id: 'ps-1', status: 'active' });
    prismaMock.parentInvite.update.mockResolvedValue({ id: 'inv-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'user' });
    prismaMock.user.update.mockResolvedValue({ id: 'par-1', role: 'parent' });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'a1' });

    const res = await redeemParentInviteAndLink({
      prisma: prismaMock as any,
      parentId: 'par-1',
      parentEmail: 'mom@example.com',
      code: 'ABCD1234',
      relationship: 'father',
      now: new Date('2026-03-03T00:00:00Z'),
    });

    expect(res.studentId).toBe('stu-1');
    expect(res.status).toBe('already_linked');
    expect(prismaMock.parentInvite.update).toHaveBeenCalled();
  });

  it('redeem invite rejects when parent already has max active children and not already linked', async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));

    prismaMock.parentInvite.findUnique.mockResolvedValue({
      id: 'inv-2',
      studentId: 'stu-2',
      status: 'pending',
      expiresAt: new Date('2026-03-10T00:00:00Z'),
    });
    prismaMock.parentStudent.findUnique.mockResolvedValue(null);
    prismaMock.parentStudent.count.mockResolvedValue(3);

    await expect(
      redeemParentInviteAndLink({
        prisma: prismaMock as any,
        parentId: 'par-1',
        parentEmail: 'mom@example.com',
        code: 'ABCD1234',
        relationship: 'guardian',
        now: new Date('2026-03-03T00:00:00Z'),
      }),
    ).rejects.toThrow('maximum linked children');
  });
});

