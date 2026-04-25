/**
 * FILE OBJECTIVE:
 * - Generate or return an admin MFA secret and otpauth QR payload during invite setup.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/setup/mfa-qr/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin setup MFA QR endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildOtpAuthUri, generateMfaSecret } from '@/lib/admin/authSecurity';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }

  const admin = await prisma.adminUser.findUnique({
    where: { inviteToken: token },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  if (!admin || admin.status !== 'INVITED' || !admin.inviteExpiresAt || admin.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 404 });
  }

  const secret = admin.mfaSecret ?? generateMfaSecret();
  if (!admin.mfaSecret) {
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { mfaSecret: secret },
    });
  }

  const email = admin.user.email ?? `admin-${admin.id}@spinzy.academy`;
  const otpauthUri = buildOtpAuthUri(email, secret);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauthUri)}`;

  return NextResponse.json({
    secret,
    otpauthUri,
    qrCodeUrl,
  });
}
