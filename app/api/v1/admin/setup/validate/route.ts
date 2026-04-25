/**
 * FILE OBJECTIVE:
 * - Validate admin invite setup token and return setup bootstrap details.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/setup/validate/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin setup validate endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!token) {
    return NextResponse.json({ valid: false, error: 'missing_token' }, { status: 400 });
  }

  const admin = await prisma.adminUser.findUnique({
    where: { inviteToken: token },
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
  });

  if (!admin || admin.status !== 'INVITED' || !admin.inviteExpiresAt || admin.inviteExpiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: 'invalid_or_expired_token' }, { status: 404 });
  }

  return NextResponse.json({
    valid: true,
    adminName: admin.user.name,
    email: admin.user.email,
    role: admin.role,
    expiresAt: admin.inviteExpiresAt,
  });
}
