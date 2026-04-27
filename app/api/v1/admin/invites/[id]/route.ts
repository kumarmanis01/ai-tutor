/**
 * FILE OBJECTIVE:
 * - Soft-delete admin accounts at DELETE /api/v1/admin/invites/:id.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/invites/delete/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:00:00Z | copilot | added A0.1 soft-delete endpoint for admin invites
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractClientIp } from '@/lib/admin/authSecurity';
import { requireSuperAdmin } from '@/lib/admin/guards';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  const guard = await requireSuperAdmin();
  if (!guard.ok || !guard.adminUserId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const ipAddress = extractClientIp(req);
  const userAgent = req.headers.get('user-agent') ?? 'unknown';

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id },
      data: {
        status: 'DELETED',
        inviteToken: null,
        inviteExpiresAt: null,
      },
    }),
    prisma.adminTrustedDevice.deleteMany({ where: { adminUserId: id } }),
    prisma.adminSession.updateMany({ where: { adminId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.adminAuditLog.create({
      data: {
        adminUserId: guard.adminUserId,
        action: 'admin.deleted',
        entityType: 'AdminUser',
        entityId: id,
        targetType: 'AdminUser',
        targetId: id,
        ipAddress,
        userAgent,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
