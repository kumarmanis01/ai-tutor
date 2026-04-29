/**
 * FILE OBJECTIVE:
 * - Admin login step 2 endpoint that verifies MFA/backup code and returns access/refresh tokens.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/auth/login/verify-mfa/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin login MFA verification endpoint
 * - 2026-04-27T18:49:00Z | copilot | persist admin refresh sessions and decrypt MFA secret at verification time
 */

import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateTokenPair } from '@/lib/auth/token.service';
import {
  computeTrustedDeviceHash,
  decryptAdminMfaSecret,
  extractClientIp,
  signAdminDeviceToken,
  toIpv4Subnet24,
  verifyAdminLoginSessionToken,
  verifyTotp,
} from '@/lib/admin/authSecurity';

export const dynamic = 'force-dynamic';

async function verifyBackupCode(hashListJson: string | null, code: string): Promise<{ ok: boolean; remaining: string[] }> {
  if (!hashListJson) return { ok: false, remaining: [] };
  const hashes = JSON.parse(hashListJson) as string[];
  for (let i = 0; i < hashes.length; i += 1) {
    const matched = await bcrypt.compare(code.trim().toUpperCase(), hashes[i]);
    if (matched) {
      const remaining = hashes.filter((_, idx) => idx !== i);
      return { ok: true, remaining };
    }
  }
  return { ok: false, remaining: hashes };
}

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const body = (await req.json().catch(() => ({}))) as {
      loginSessionToken?: string;
      totpCode?: string;
      backupCode?: string;
      rememberDevice?: boolean;
    };

    const loginSessionToken = typeof body.loginSessionToken === 'string' ? body.loginSessionToken : '';
    if (!loginSessionToken) {
      return NextResponse.json({ error: 'missing_login_session_token' }, { status: 400 });
    }

    const claims = await verifyAdminLoginSessionToken(loginSessionToken);
    const admin = await prisma.adminUser.findUnique({
      where: { id: claims.adminUserId },
      include: { user: { select: { id: true } } },
    });

    if (!admin || admin.status !== 'ACTIVE' || !admin.user) {
      return NextResponse.json({ error: 'invalid_login_session' }, { status: 401 });
    }

    const totpCode = typeof body.totpCode === 'string' ? body.totpCode : '';
    const backupCode = typeof body.backupCode === 'string' ? body.backupCode : '';

    let mfaVerified = false;
    let remainingBackupHashes: string[] | null = null;

    if (backupCode) {
      const backup = await verifyBackupCode(admin.mfaBackupCodes, backupCode);
      mfaVerified = backup.ok;
      remainingBackupHashes = backup.remaining;
    } else if (admin.mfaSecret && totpCode) {
      mfaVerified = verifyTotp(decryptAdminMfaSecret(admin.mfaSecret), totpCode, 1);
    }

    if (!mfaVerified) {
      return NextResponse.json({ error: 'invalid_mfa_code' }, { status: 401 });
    }

    const ip = extractClientIp(req);
    const subnet24 = toIpv4Subnet24(ip);
    const userAgent = req.headers.get('user-agent') ?? 'unknown';
    const deviceHash = computeTrustedDeviceHash(userAgent, subnet24);

    if (body.rememberDevice === true) {
      const signedDeviceToken = await signAdminDeviceToken(admin.id, subnet24);
      await prisma.adminTrustedDevice.upsert({
        where: {
          adminUserId_deviceHash: {
            adminUserId: admin.id,
            deviceHash,
          },
        },
        create: {
          adminUserId: admin.id,
          deviceHash,
          deviceToken: signedDeviceToken,
          ipSubnet: subnet24,
          fingerprint: deviceHash,
          label: 'Remembered device',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lastUsedAt: new Date(),
        },
        update: {
          deviceToken: signedDeviceToken,
          ipSubnet: subnet24,
          fingerprint: deviceHash,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lastUsedAt: new Date(),
        },
      });
    }

    const tokens = await generateTokenPair({ sub: admin.user.id, role: admin.role, scope: 'admin' });

    await prisma.adminSession.create({
      data: {
        adminId: admin.id,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: ip,
        userAgent,
      },
    });

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        mfaBackupCodes: remainingBackupHashes ? JSON.stringify(remainingBackupHashes) : admin.mfaBackupCodes,
        backupCodesHash: remainingBackupHashes ? JSON.stringify(remainingBackupHashes) : admin.backupCodesHash,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        action: 'admin.login_success',
        entityType: 'AdminUser',
        entityId: admin.id,
        payload: {
          usedBackupCode: Boolean(backupCode),
          rememberedDevice: body.rememberDevice === true,
        },
        details: {
          usedBackupCode: Boolean(backupCode),
          rememberedDevice: body.rememberDevice === true,
        },
        targetType: 'AdminUser',
        targetId: admin.id,
        ipAddress: ip,
        userAgent,
      },
    });

    let deviceToken: string | null = null;
    if (body.rememberDevice === true) {
      deviceToken = await signAdminDeviceToken(admin.id, subnet24);
    }

    const res = NextResponse.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      deviceToken,
    });
    res.cookies.set('__admin_tok', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 60, // matches 30-min access token TTL
      secure: process.env.NODE_ENV === 'production',
    });
    logger.logAPI(req, res, { className: 'AdminLoginVerifyMFAAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('admin.auth.login.verify-mfa failed', { error: String(err) });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
