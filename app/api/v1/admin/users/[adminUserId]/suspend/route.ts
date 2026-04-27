/**
 * FILE OBJECTIVE:
 * - Suspend an admin account by setting AdminUser status to INACTIVE.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/users/suspend/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin suspend endpoint
 * - 2026-04-27T18:42:00Z | copilot | switch suspend status to SUSPENDED and add audit metadata
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

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: adminUserId },
      data: { status: 'SUSPENDED' },
    }),
    prisma.adminTrustedDevice.deleteMany({ where: { adminUserId } }),
  ]);

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: guard.adminUserId,
      action: 'admin.suspended',
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
