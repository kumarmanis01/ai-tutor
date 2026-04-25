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
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin/guards';
import { generateInviteToken } from '@/lib/admin/authSecurity';
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
        select: { email: true },
      },
    },
  });

  if (!admin.user.email) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 });
  }

  const setupBase = process.env.NEXT_PUBLIC_ADMIN_APP_URL ?? 'https://admin.spinzy.academy';
  const setupLink = `${setupBase}/setup?token=${token}`;
  await sendAdminInvite(admin.user.email, setupLink, admin.role);

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: guard.adminUserId,
      action: 'admin.invite_resent',
      entityType: 'AdminUser',
      entityId: admin.id,
      payload: { inviteExpiresAt: expiresAt.toISOString() },
    },
  });

  return NextResponse.json({ ok: true });
}
