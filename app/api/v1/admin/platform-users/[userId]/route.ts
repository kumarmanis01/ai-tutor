/**
 * FILE OBJECTIVE:
 * - Platform user management: view profile (GET), update fields (PATCH), soft-delete (DELETE).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/platform-users/[userId]/route.spec.ts
 *
 * EDIT LOG:
 * - 2026-05-03T00:00:00Z | claude | created GET/PATCH/DELETE for platform user management (A3.1)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveAdmin, requireSuperAdmin } from '@/lib/admin/guards';
import { extractClientIp } from '@/lib/admin/authSecurity';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ userId: string }>;
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  grade: true,
  board: true,
  age: true,
  isAdult: true,
  accountStatus: true,
  subscriptionStatus: true,
  subscriptionExpiry: true,
  role: true,
  totalXp: true,
  level: true,
  currentStreak: true,
  lastSessionDate: true,
  createdAt: true,
  schoolName: true,
  subjects: true,
} as const;

export async function GET(_req: Request, { params }: Params) {
  const guard = await requireActiveAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });

  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Content admins get anonymized PII
  if (guard.role === 'CONTENT_ADMIN') {
    return NextResponse.json({
      ok: true,
      user: {
        ...user,
        email: user.email ? `${user.email[0]}***@***` : null,
        phone: user.phone ? `***${user.phone.slice(-4)}` : null,
        name: user.name ? `${user.name.split(' ')[0]} ***` : null,
      },
    });
  }

  return NextResponse.json({ ok: true, user });
}

export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireActiveAdmin();
  if (!guard.ok || !guard.adminUserId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (guard.role !== 'SUPER_ADMIN' && guard.role !== 'SUPPORT_ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { userId } = await params;

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // grade/board immutable after first save -- strip from all PATCH handlers
  const { grade: _g, board: _b, role: _r, id: _id, ...allowedFields } = body;

  const PATCHABLE = ['name', 'subscriptionStatus', 'schoolName'] as const;
  const data: Record<string, unknown> = {};
  for (const key of PATCHABLE) {
    if (key in allowedFields) data[key] = allowedFields[key];
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'no_patchable_fields' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: USER_SELECT,
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: guard.adminUserId,
      action: 'platform_user.updated',
      entityType: 'User',
      entityId: userId,
      targetType: 'User',
      targetId: userId,
      ipAddress: extractClientIp(req),
      userAgent: req.headers.get('user-agent') ?? 'unknown',
      payload: { fields: Object.keys(data) },
      details: { fields: Object.keys(data) },
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}

export async function DELETE(req: Request, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (!guard.ok || !guard.adminUserId) {
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

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: 'deletion_pending' },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: guard.adminUserId,
      action: 'platform_user.deletion_requested',
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
