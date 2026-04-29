/**
 * FILE OBJECTIVE:
 * - Logout admin sessions by revoking tokens and clearing optional trusted-device binding.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/auth/logout/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:00:00Z | copilot | added admin logout endpoint with blacklist and session revocation
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { blacklistToken } from '@/lib/auth/blacklist.service';
import { verifyAdminAccessToken, verifyAdminRefreshToken } from '@/lib/auth/token.service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    accessToken?: string;
    refreshToken?: string;
    deviceToken?: string;
  };

  const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
  const deviceToken = typeof body.deviceToken === 'string' ? body.deviceToken : '';

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ error: 'missing_tokens' }, { status: 400 });
  }

  const jobs: Array<Promise<unknown>> = [];

  if (accessToken) {
    jobs.push(
      verifyAdminAccessToken(accessToken)
        .then((payload) => blacklistToken(payload.jti, payload.exp))
        .catch(() => undefined)
    );
  }

  if (refreshToken) {
    jobs.push(
      verifyAdminRefreshToken(refreshToken)
        .then(async (payload) => {
          await blacklistToken(payload.jti, payload.exp);
          await prisma.adminSession.updateMany({
            where: { refreshToken, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        })
        .catch(() => undefined)
    );
  }

  if (deviceToken) {
    jobs.push(
      prisma.adminTrustedDevice.deleteMany({
        where: { deviceToken },
      })
    );
  }

  await Promise.all(jobs);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('__admin_tok', '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
