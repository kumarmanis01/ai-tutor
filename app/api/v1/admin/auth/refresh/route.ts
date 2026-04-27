/**
 * FILE OBJECTIVE:
 * - Rotate admin refresh tokens and enforce refresh-token blacklist/session revocation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/auth/refresh/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:00:00Z | copilot | added admin refresh endpoint with token rotation and AdminSession persistence
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  TokenExpiredError,
  TokenInvalidError,
  generateTokenPair,
  verifyAdminRefreshToken,
} from '@/lib/auth/token.service';
import { blacklistToken, isBlacklisted } from '@/lib/auth/blacklist.service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as { refreshToken?: string };
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';

    if (!refreshToken) {
      return NextResponse.json({ error: 'missing_refresh_token' }, { status: 400 });
    }

    const payload = await verifyAdminRefreshToken(refreshToken);
    const revoked = await isBlacklisted(payload.jti);
    if (revoked) {
      return NextResponse.json({ error: 'token_revoked' }, { status: 401 });
    }

    const existingSession = await prisma.adminSession.findUnique({ where: { refreshToken } });
    if (!existingSession || existingSession.revokedAt || existingSession.expiresAt < new Date()) {
      return NextResponse.json({ error: 'invalid_refresh_session' }, { status: 401 });
    }

    const admin = await prisma.adminUser.findFirst({
      where: { id: existingSession.adminId },
      include: { user: { select: { id: true } } },
    });

    if (!admin?.user || admin.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'admin_not_active' }, { status: 401 });
    }

    await blacklistToken(payload.jti, payload.exp);

    const tokens = await generateTokenPair({ sub: admin.user.id, role: admin.role, scope: 'admin' });

    await prisma.$transaction([
      prisma.adminSession.update({ where: { refreshToken }, data: { revokedAt: new Date() } }),
      prisma.adminSession.create({
        data: {
          adminId: admin.id,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ipAddress: existingSession.ipAddress,
          userAgent: existingSession.userAgent,
        },
      }),
    ]);

    return NextResponse.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    if (err instanceof TokenExpiredError || err instanceof TokenInvalidError) {
      return NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
