/**
 * FILE OBJECTIVE:
 * - Resend an admin invite token and email for invited admin accounts.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/users/resend/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin invite resend endpoint
 * - 2026-04-27T18:42:00Z | copilot | align resend invite email payload and audit context for A0.1
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin/guards';
import { extractClientIp, generateInviteToken } from '@/lib/admin/authSecurity';
import { sendAdminInvite } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ adminUserId: string }>;
}

export async function POST(_req: Request, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (!guard.ok || !guard.adminUserId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { adminUserId } = await params;
  const ipAddress = extractClientIp(_req);
  const userAgent = _req.headers.get('user-agent') ?? 'unknown';
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const admin = await prisma.adminUser.update({
    where: { id: adminUserId },
    data: {
      status: 'INVITED',
      inviteToken: token,
      inviteExpiresAt: expiresAt,
      invitedAt: new Date(),
    },
    include: {
      user: {
        select: { email: true, name: true },
      },
    },
  });

  if (!admin.user.email) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 });
  }

  const setupBase = process.env.NEXT_PUBLIC_ADMIN_APP_URL ?? 'https://admin.spinzy.academy';
  const setupLink = `${setupBase}/setup?token=${token}`;
  await sendAdminInvite(admin.user.email, setupLink, admin.role, admin.user.name ?? undefined);

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: guard.adminUserId,
      action: 'admin.invite_resent',
      entityType: 'AdminUser',
      entityId: admin.id,
      targetType: 'AdminUser',
      targetId: admin.id,
      ipAddress,
      userAgent,
      payload: { inviteExpiresAt: expiresAt.toISOString() },
      details: { inviteExpiresAt: expiresAt.toISOString() },
    },
  });

  return NextResponse.json({ ok: true });
}
