/**
 * FILE OBJECTIVE:
 * - Reactivate an admin account by setting AdminUser status to ACTIVE.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/users/reactivate/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin reactivate endpoint
 * - 2026-04-27T18:42:00Z | copilot | align reactivation with SUSPENDED flow and audit metadata
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractClientIp } from '@/lib/admin/authSecurity';
import { requireSuperAdmin } from '@/lib/admin/guards';

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

  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { status: 'ACTIVE', lockoutUntil: null, failedLoginAttempts: 0 },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: guard.adminUserId,
      action: 'admin.reactivated',
      entityType: 'AdminUser',
      entityId: adminUserId,
      targetType: 'AdminUser',
      targetId: adminUserId,
      ipAddress,
      userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}
