/**
 * FILE OBJECTIVE:
 * - Rotate user refresh tokens and issue a fresh token pair.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/auth/refresh/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created v1 auth refresh endpoint
 */

import { NextResponse } from 'next/server';
import {
  generateTokenPair,
  verifyUserRefreshToken,
  TokenExpiredError,
  TokenInvalidError,
} from '@/lib/auth/token.service';
import { blacklistToken, isBlacklisted } from '@/lib/auth/blacklist.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const body = (await req.json().catch(() => ({}))) as { refreshToken?: string };
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';

    if (!refreshToken) {
      return NextResponse.json({ error: 'missing_refresh_token' }, { status: 400 });
    }

    const payload = await verifyUserRefreshToken(refreshToken);
    const revoked = await isBlacklisted(payload.jti);
    if (revoked) {
      return NextResponse.json({ error: 'token_revoked' }, { status: 401 });
    }

    await blacklistToken(payload.jti, payload.exp);

    const tokens = await generateTokenPair({
      sub: payload.sub,
      role: payload.role,
      scope: payload.scope,
    });

    const res = NextResponse.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    logger.logAPI(req, res, { className: 'AuthRefreshAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    if (err instanceof TokenExpiredError || err instanceof TokenInvalidError) {
      return NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 401 });
    }
    logger.error('auth.refresh failed', { error: String(err) });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
