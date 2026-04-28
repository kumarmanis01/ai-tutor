/**
 * FILE OBJECTIVE:
 * - Logout endpoint that revokes active access/refresh tokens by blacklisting JTIs.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/auth/logout/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created v1 auth logout endpoint
 */

import { NextResponse } from 'next/server';
import { verifyUserAccessToken, verifyUserRefreshToken } from '@/lib/auth/token.service';
import { blacklistToken } from '@/lib/auth/blacklist.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const body = (await req.json().catch(() => ({}))) as {
      accessToken?: string;
      refreshToken?: string;
    };

    const jobs: Array<Promise<void>> = [];

    if (typeof body.accessToken === 'string' && body.accessToken) {
      jobs.push(
        verifyUserAccessToken(body.accessToken)
          .then((p) => blacklistToken(p.jti, p.exp))
          .catch(() => Promise.resolve())
      );
    }

    if (typeof body.refreshToken === 'string' && body.refreshToken) {
      jobs.push(
        verifyUserRefreshToken(body.refreshToken)
          .then((p) => blacklistToken(p.jti, p.exp))
          .catch(() => Promise.resolve())
      );
    }

    await Promise.all(jobs);

    const res = NextResponse.json({ ok: true });
    logger.logAPI(req, res, { className: 'AuthLogoutAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('auth.logout failed', { error: String(err) });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
