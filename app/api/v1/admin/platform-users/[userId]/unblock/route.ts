/**
 * FILE OBJECTIVE:
 * - Unblock a platform user by restoring accountStatus to 'active'.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/platform-users/[userId]/route.spec.ts
 *
 * EDIT LOG:
 * - 2026-05-03T00:00:00Z | claude | created unblock endpoint for platform user management
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveAdmin } from '@/lib/admin/guards';
import { extractClientIp } from '@/lib/admin/authSecurity';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ userId: string }>;
}

export async function POST(req: Request, { params }: Params) {
  const guard = await requireActiveAdmin();
  if (!guard.ok || !guard.adminUserId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (guard.role !== 'SUPER_ADMIN' && guard.role !== 'SUPPORT_ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { userId } = await params;

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, accountStatus: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (existing.accountStatus === 'active') {
    return NextResponse.json({ error: 'already_active' }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: 'active' },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: guard.adminUserId,
      action: 'platform_user.unblocked',
      entityType: 'User',
      entityId: userId,
      targetType: 'User',
      targetId: userId,
      ipAddress: extractClientIp(req),
      userAgent: req.headers.get('user-agent') ?? 'unknown',
    },
  });

  return NextResponse.json({ ok: true });
}
