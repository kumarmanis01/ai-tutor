import { randomBytes } from 'crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

export const PARENT_INVITE_TTL_DAYS = 7;

export type InviteCreateResult = {
  code: string;
  expiresAt: string;
};

export type InviteRedeemResult = {
  studentId: string;
  status: 'linked' | 'already_linked';
};

function generateCode(): string {
  // 8-char hex code (uppercase) -- easy to read/type on mobile.
  return randomBytes(4).toString('hex').toUpperCase();
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function createOrReuseParentInviteForStudent(params: {
  prisma: PrismaClient;
  studentId: string;
  now?: Date;
}): Promise<InviteCreateResult> {
  const { prisma, studentId } = params;
  const now = params.now ?? new Date();

  // Reuse an active pending invite if it exists and hasn't expired.
  const existing = await prisma.parentInvite.findFirst({
    where: {
      studentId,
      status: 'pending',
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
    select: { code: true, expiresAt: true },
  });

  if (existing) {
    return { code: existing.code, expiresAt: existing.expiresAt.toISOString() };
  }

  // Create a new invite with a unique code.
  const expiresAt = addDays(now, PARENT_INVITE_TTL_DAYS);
  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const conflict = await prisma.parentInvite.findUnique({ where: { code }, select: { id: true } });
    if (!conflict) break;
    code = generateCode();
  }

  const invite = await prisma.parentInvite.create({
    data: {
      studentId,
      code,
      status: 'pending',
      expiresAt,
    },
    select: { code: true, expiresAt: true },
  });

  return { code: invite.code, expiresAt: invite.expiresAt.toISOString() };
}

export async function redeemParentInviteAndLink(params: {
  prisma: PrismaClient;
  parentId: string;
  parentEmail?: string | null;
  code: string;
  now?: Date;
}): Promise<InviteRedeemResult> {
  const { prisma, parentId, code } = params;
  const now = params.now ?? new Date();

  const normalizedCode = String(code).trim().toUpperCase();
  if (!normalizedCode || normalizedCode.length < 6) {
    throw new Error('Invalid invite code');
  }

  return await prisma.$transaction(async (tx) => {
    const invite = await tx.parentInvite.findUnique({
      where: { code: normalizedCode },
      select: { id: true, studentId: true, status: true, expiresAt: true },
    });

    if (!invite || invite.status !== 'pending' || invite.expiresAt <= now) {
      // Best-effort: if it exists but expired, mark it.
      if (invite && invite.status === 'pending' && invite.expiresAt <= now) {
        await tx.parentInvite.update({
          where: { id: invite.id },
          data: { status: 'expired' },
        }).catch(() => {});
      }
      throw new Error('Invalid or expired invite code');
    }

    if (invite.studentId === parentId) {
      throw new Error('Cannot link to yourself');
    }

    const existing = await tx.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId: invite.studentId } },
      select: { id: true, status: true },
    });

    if (existing?.status === 'active') {
      await tx.parentInvite.update({
        where: { id: invite.id },
        data: { status: 'consumed', consumedAt: now, consumedByParentId: parentId },
      });

    await ensureParentRole(tx, parentId);
    try {
      await tx.auditLog.create({
        data: {
          adminId: parentId,
          targetEntity: 'User',
          targetId: invite.studentId,
          action: null,
          details: { legacyAction: 'parent_link_student', parentId, method: 'invite_code', status: 'already_linked' },
        },
      });
    } catch {
      // Non-fatal: audit log failure should not break linking
    }

      return { studentId: invite.studentId, status: 'already_linked' };
    }

    if (existing?.status === 'revoked') {
      await tx.parentStudent.update({
        where: { id: existing.id },
        data: { status: 'active' },
      });
    } else if (!existing) {
      await tx.parentStudent.create({
        data: { parentId, studentId: invite.studentId, status: 'active' },
      });
    }

    await tx.parentInvite.update({
      where: { id: invite.id },
      data: { status: 'consumed', consumedAt: now, consumedByParentId: parentId },
    });

    await ensureParentRole(tx, parentId);

    try {
      await tx.auditLog.create({
        data: {
          adminId: parentId,
          targetEntity: 'User',
          targetId: invite.studentId,
          action: null,
          details: { legacyAction: 'parent_link_student', parentId, method: 'invite_code', status: 'linked' },
        },
      });
    } catch {
      // Non-fatal: audit log failure should not break linking
    }

    return { studentId: invite.studentId, status: 'linked' };
  });
}

export async function linkParentToStudentByEmail(params: {
  prisma: PrismaClient;
  parentId: string;
  parentEmail?: string | null;
  studentEmail: string;
}): Promise<{ studentId: string; status: 'linked' | 'already_linked' }> {
  const { prisma, parentId } = params;
  const parentEmail = (params.parentEmail ?? '').trim().toLowerCase();
  const studentEmail = String(params.studentEmail).trim().toLowerCase();

  if (!studentEmail) throw new Error('studentEmail required');
  if (!parentEmail) {
    throw new Error('Parent email missing from session');
  }

  const student = await prisma.user.findUnique({
    where: { email: studentEmail },
    select: { id: true, parentEmail: true },
  });
  if (!student) throw new Error('Student not found');
  if (student.id === parentId) throw new Error('Cannot link to yourself');

  // Privacy guard: only allow email-based linking if the student has explicitly set parentEmail.
  const allowed = (student.parentEmail ?? '').trim().toLowerCase() === parentEmail;
  if (!allowed) {
    throw new Error('Linking by email is not enabled for this student. Use an invite code.');
  }

  const existing = await prisma.parentStudent.findUnique({
    where: { parentId_studentId: { parentId, studentId: student.id } },
    select: { id: true, status: true },
  });

  if (existing?.status === 'active') {
    await prisma.auditLog
      .create({
        data: {
          adminId: parentId,
          targetEntity: 'User',
          targetId: student.id,
          action: null,
          details: { legacyAction: 'parent_link_student', parentId, method: 'email', status: 'already_linked' },
        },
      })
      .catch(() => {});
    return { studentId: student.id, status: 'already_linked' };
  }

  if (existing?.status === 'revoked') {
    await prisma.parentStudent.update({ where: { id: existing.id }, data: { status: 'active' } });
  } else if (!existing) {
    await prisma.parentStudent.create({ data: { parentId, studentId: student.id, status: 'active' } });
  }

  await ensureParentRole(prisma, parentId);

  try {
    await prisma.auditLog.create({
      data: {
        adminId: parentId,
        targetEntity: 'User',
        targetId: student.id,
        action: null,
        details: { legacyAction: 'parent_link_student', parentId, method: 'email', status: 'linked' },
      },
    });
  } catch {
    // Non-fatal: audit log failure should not break linking
  }

  return { studentId: student.id, status: 'linked' };
}

async function ensureParentRole(prisma: Prisma.TransactionClient, parentId: string) {
  try {
    const parent = await prisma.user.findUnique({ where: { id: parentId }, select: { role: true } });
    if (parent?.role === 'user') {
      await prisma.user.update({ where: { id: parentId }, data: { role: 'parent' } });
    }
  } catch (err) {
    logger.warn('ensureParentRole failed', { parentId, error: String(err) });
  }
}

