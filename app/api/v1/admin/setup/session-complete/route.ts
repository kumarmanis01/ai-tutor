/**
 * FILE OBJECTIVE:
 * - Complete session-based MFA setup (first-login) by validating TOTP and persisting backup codes.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/setup/session-complete/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | added session-based MFA completion endpoint
 */

import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateTokenPair } from '@/lib/auth/token.service';
import {
  decryptAdminMfaSecret,
  extractClientIp,
  generateBackupCodes,
  verifyAdminLoginSessionToken,
  verifyTotp,
} from '@/lib/admin/authSecurity';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    loginSessionToken?: string;
    totpCode?: string;
    backupCodesSaved?: boolean;
  };

  const loginSessionToken = typeof body.loginSessionToken === 'string' ? body.loginSessionToken : '';
  const totpCode = typeof body.totpCode === 'string' ? body.totpCode : '';
  const backupCodesSaved = body.backupCodesSaved === true;

  if (!loginSessionToken || !totpCode) {
    return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
  }

  let claims;
  try {
    claims = await verifyAdminLoginSessionToken(loginSessionToken);
  } catch (err) {
    return NextResponse.json({ error: 'invalid_session_token' }, { status: 401 });
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: claims.adminUserId } });
  if (!admin || admin.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'invalid_admin' }, { status: 404 });
  }

  if (admin.mfaEnabled) {
    return NextResponse.json({ error: 'mfa_already_enabled' }, { status: 400 });
  }

  const mfaSecret = admin.mfaSecret ? decryptAdminMfaSecret(admin.mfaSecret) : null;
  if (!mfaSecret || !verifyTotp(mfaSecret, totpCode, 1)) {
    return NextResponse.json({ error: 'invalid_mfa_code' }, { status: 400 });
  }

  if (!backupCodesSaved) {
    return NextResponse.json({ error: 'backup_codes_ack_required' }, { status: 400 });
  }

  const backupCodes = generateBackupCodes(10);
  const backupCodeHashes = await Promise.all(backupCodes.map((code) => bcrypt.hash(code, 12)));

  const ipAddress = extractClientIp(req);
  const userAgent = req.headers.get('user-agent') ?? 'unknown';

  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id: admin.id },
      data: {
        mfaEnabled: true,
        mfaBackupCodes: JSON.stringify(backupCodeHashes),
        backupCodesHash: JSON.stringify(backupCodeHashes),
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        action: 'super_admin.first_login',
        entityType: 'AdminUser',
        entityId: admin.id,
        targetType: 'AdminUser',
        targetId: admin.id,
        ipAddress,
        userAgent,
      },
    });
  });

  const admin2 = await prisma.adminUser.findUnique({
    where: { id: admin.id },
    include: { user: { select: { id: true } } },
  });
  if (!admin2?.user) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const tokens = await generateTokenPair({ sub: admin2.user.id, role: admin2.role, scope: 'admin' });

  await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress,
      userAgent,
    },
  });

  const res = NextResponse.json({
    ok: true,
    backupCodes,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
  res.cookies.set('__admin_tok', tokens.accessToken, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 60,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
