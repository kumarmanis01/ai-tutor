/**
 * FILE OBJECTIVE:
 * - Generate or return an admin MFA secret and otpauth QR payload during first-login session setup.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/setup/session-mfa-qr/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | created session-based MFA QR endpoint for first-login flow
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildOtpAuthUri,
  decryptAdminMfaSecret,
  encryptAdminMfaSecret,
  generateMfaSecret,
  verifyAdminLoginSessionToken,
} from '@/lib/admin/authSecurity';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionToken = url.searchParams.get('sessionToken') ?? '';
  if (!sessionToken) {
    return NextResponse.json({ error: 'missing_session_token' }, { status: 400 });
  }

  let claims;
  try {
    claims = await verifyAdminLoginSessionToken(sessionToken);
  } catch {
    return NextResponse.json({ error: 'invalid_session_token' }, { status: 401 });
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: claims.adminUserId }, include: { user: { select: { email: true } } } });
  if (!admin || admin.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'invalid_admin' }, { status: 404 });
  }

  if (admin.mfaEnabled) {
    return NextResponse.json({ error: 'mfa_already_enabled' }, { status: 400 });
  }

  const secret = admin.mfaSecret ? decryptAdminMfaSecret(admin.mfaSecret) : generateMfaSecret();
  if (!admin.mfaSecret) {
    await prisma.adminUser.update({ where: { id: admin.id }, data: { mfaSecret: encryptAdminMfaSecret(secret) } });
  }

  const email = admin.user.email ?? `admin-${admin.id}@spinzy.academy`;
  const otpauthUri = buildOtpAuthUri(email, secret);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauthUri)}`;

  return NextResponse.json({ secret, otpauthUri, qrCodeUrl, qr_code_data_url: qrCodeUrl });
}
