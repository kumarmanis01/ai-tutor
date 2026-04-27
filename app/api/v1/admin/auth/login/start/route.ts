/**
 * FILE OBJECTIVE:
 * - Admin login step 1 endpoint that validates credentials, enforces lockout, and returns MFA session token.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/auth/login/start/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created admin login start endpoint with lockout and MFA session
 * - 2026-04-27T18:49:00Z | copilot | enforce admin IP whitelist and align lockout/session behavior with A0.3
 */

import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendMailSafe } from '@/lib/mailer';
import { generateTokenPair } from '@/lib/auth/token.service';
import { isAllowedAdminIp } from '@/lib/admin/ipWhitelist';
import {
  computeTrustedDeviceHash,
  extractClientIp,
  normalizeEmail,
  signAdminLoginSessionToken,
  toIpv4Subnet24,
} from '@/lib/admin/authSecurity';

export const dynamic = 'force-dynamic';

const LOCKOUT_MINUTES = 15;

async function sendSuperAdminLockoutAlert(email: string): Promise<void> {
  const superAdmins = await prisma.adminUser.findMany({
    where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
    select: { user: { select: { email: true } } },
  });

  const recipients = superAdmins
    .map((a) => a.user.email)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);

  await Promise.all(
    recipients.map((to) =>
      sendMailSafe({
        to,
        subject: 'Admin login alert -- repeated failed attempts',
        html: `<p>Admin account ${email} has reached 5 failed login attempts.</p>`,
      })
    )
  );
}

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const ip = extractClientIp(req);
    const userAgent = req.headers.get('user-agent') ?? 'unknown';

    if (!isAllowedAdminIp(ip)) {
      return NextResponse.json(
        { error: 'unauthorized_network', message: 'Access Denied: Unauthorized Network' },
        { status: 403 }
      );
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'missing_credentials' }, { status: 400 });
    }

    const admin = await prisma.adminUser.findFirst({
      where: {
        user: { email },
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    if (
      !admin ||
      !admin.passwordHash ||
      admin.status !== 'ACTIVE' ||
      admin.status === 'SUSPENDED' ||
      admin.status === 'DELETED'
    ) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    if (admin.lockoutUntil && admin.lockoutUntil > new Date()) {
      return NextResponse.json(
        { error: 'locked_out', message: 'Too many failed attempts. Try again later.' },
        { status: 423 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!isValidPassword) {
      const nextAttempts = admin.failedLoginAttempts + 1;
      const shouldLock = nextAttempts >= 3;

      await prisma.adminUser.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: nextAttempts,
          lockoutUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
        },
      });

      if (nextAttempts >= 5 && admin.user.email) {
        await sendSuperAdminLockoutAlert(admin.user.email);
      }

      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const subnet24 = toIpv4Subnet24(ip);
    const deviceHash = computeTrustedDeviceHash(userAgent, subnet24);

    const trustedDevice = await prisma.adminTrustedDevice.findUnique({
      where: {
        adminUserId_deviceHash: {
          adminUserId: admin.id,
          deviceHash,
        },
      },
    });

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    if (trustedDevice && trustedDevice.expiresAt > new Date()) {
      const tokens = await generateTokenPair({ sub: admin.user.id, role: admin.role, scope: 'admin' });
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date(), lastLoginIp: ip },
      });
      return NextResponse.json({
        requiresMfa: false,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    }

    const loginSessionToken = await signAdminLoginSessionToken(admin.id, admin.role);
    const res = NextResponse.json({
      requiresMfa: true,
      loginSessionToken,
      lockoutThreshold: 3,
    });
    logger.logAPI(req, res, { className: 'AdminLoginStartAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('admin.auth.login.start failed', { error: String(err) });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
