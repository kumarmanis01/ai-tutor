import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { LanguageCode } from '@prisma/client';
import { NextResponse } from 'next/server';

type VerifyRequestBody = {
  accessToken?: string;
};

export async function POST(req: Request) {
  try {
    const body: VerifyRequestBody = await req.json().catch(() => ({}));
    logger.info('[verify-access-token] incoming body keys', { className: 'api.msg91.verify-access-token', methodName: 'POST', keys: Object.keys(body || {}) });

    const accessToken = body.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: 'missing_access_token', message: 'accessToken is required in request body' }, { status: 400 });
    }

    const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
    if (!MSG91_AUTH_KEY) {
      return NextResponse.json({ error: 'server_misconfigured', message: 'MSG91_AUTH_KEY is not set in environment' }, { status: 500 });
    }

    const url = 'https://control.msg91.com/api/v5/widget/verifyAccessToken';
    const payload = {
      authkey: MSG91_AUTH_KEY,
      'access-token': accessToken,
    } as Record<string, unknown>;

    logger.info('[verify-access-token] calling provider', { className: 'api.msg91.verify-access-token', methodName: 'POST', url });
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = await resp.json().catch(() => ({}));
    logger.info('[verify-access-token] provider response', { className: 'api.msg91.verify-access-token', methodName: 'POST', status: resp.status, ok: resp.ok, body: json });

    if (!resp.ok) {
      logger.warn('[verify-access-token] provider returned error', { className: 'api.msg91.verify-access-token', methodName: 'POST', status: resp.status, body: json });
      return NextResponse.json({ error: 'provider_error', details: json }, { status: resp.status });
    }

    // Try to extract a phone/identifier from the provider response so we can
    // create or upsert a lightweight user record and establish a short-lived
    // cookie for onboarding flows (used when NextAuth session isn't created yet).
    try {
      // Best-effort extraction for common keys
      const possibleKeys = ['identifier', 'mobile', 'phone', 'number', 'msisdn'];
      let found: string | undefined;
      if (json && typeof json === 'object') {
        for (const k of possibleKeys) {
          if ((json as any)[k]) {
            found = String((json as any)[k]);
            break;
          }
        }
        // Some providers wrap data under `data` or `result`
        if (!found && (json as any).data && typeof (json as any).data === 'object') {
          for (const k of possibleKeys) {
            if ((json as any).data[k]) {
              found = String((json as any).data[k]);
              break;
            }
          }
        }
      }

      logger.info('[verify-access-token] extracted identifier', { className: 'api.msg91.verify-access-token', methodName: 'POST', found });

      // If we found a phone-like value, normalize digits and upsert a User.
      if (found) {
        const digits = found.replace(/[^0-9+]/g, '');
        // Keep the raw digits (no formatting). Do not assume country code.
        const phone = digits;

        // Lazy import prisma to avoid loading when not configured
        try {
          const { prisma } = await import('@/lib/prisma');
          // Upsert a minimal user record tied to this phone (phone is unique in schema)
          const user = await prisma.user.upsert({
            where: { phone },
            update: {},
            create: { phone, language: LanguageCode.en },
          });

          logger.info('[verify-access-token] upserted user', { className: 'api.msg91.verify-access-token', methodName: 'POST', id: user.id, phone: user.phone });

          const res = NextResponse.json({ ok: true, data: json, userId: user.id, user });
          // Set a short-lived HttpOnly cookie to allow subsequent onboarding call
          const maxAge = 60 * 60 * 24 * 7; // 7 days
          const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
          const cookieValue = `onboard_user_id=${user.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`;
          logger.info('[verify-access-token] setting cookie', { className: 'api.msg91.verify-access-token', methodName: 'POST', cookieSnippet: cookieValue.slice(0, 80) });
          res.headers.set('Set-Cookie', cookieValue);
          return res;
        } catch (e) {
          logger.warn('prisma upsert in verify-access-token failed', { className: 'api.msg91.verify-access-token', methodName: 'POST', error: e });
          // Continue to return provider response without cookie
        }
      }
    } catch (e) {
      logger.warn('extracting identifier from provider response failed', { className: 'api.msg91.verify-access-token', methodName: 'POST', error: e });
    }

    return NextResponse.json({ ok: true, data: json });
  } catch (err) {
    logger.error('MSG91 verify-access-token error', { className: 'api.msg91.verify-access-token', methodName: 'POST', error: err });
    return NextResponse.json({ error: formatErrorForResponse(err), message: 'Failed to verify access token' }, { status: 500 });
  }
}
