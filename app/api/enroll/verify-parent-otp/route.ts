/**
 * FILE OBJECTIVE:
 * - Verify the 6-digit parent OTP stored in Redis during the enrollment flow.
 * - On success: sets parentVerifiedAt on the user record.
 * - Locked out after 5 failed attempts for 1 hour.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/enroll/verify-parent-otp/route.test.ts
 *
 * EDIT LOG:
 * - 2026-05-05 | claude | created for DPDP enrollment consent flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getRedis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { invalidateUserSessionCache } from '@/lib/auth';
import { formatErrorForResponse } from '@/lib/errorResponse';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 3600;

function otpKey(userId: string): string {
  return `enroll:otp:parent:${userId}`;
}
function attemptsKey(userId: string): string {
  return `enroll:otp:parent:attempts:${userId}`;
}
function lockKey(userId: string): string {
  return `enroll:otp:parent:locked:${userId}`;
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  let res: Response;
  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'EnrollVerifyParentOtpAPI', methodName: 'POST' }, start);
      return res;
    }

    const body = await req.json().catch(() => ({}));
    const otp = typeof body.otp === 'string' ? body.otp.replace(/\s/g, '') : '';
    if (!/^\d{6}$/.test(otp)) {
      res = NextResponse.json({ error: 'OTP must be 6 digits' }, { status: 400 });
      logger.logAPI(req, res, { className: 'EnrollVerifyParentOtpAPI', methodName: 'POST' }, start);
      return res;
    }

    const redis = getRedis();

    // ── Lockout check ─────────────────────────────────────────────────────────
    const locked = await redis.get(lockKey(userId));
    if (locked) {
      res = NextResponse.json({ error: 'Too many incorrect attempts. Try again in 1 hour.' }, { status: 429 });
      logger.logAPI(req, res, { className: 'EnrollVerifyParentOtpAPI', methodName: 'POST' }, start);
      return res;
    }

    // ── Fetch stored OTP ──────────────────────────────────────────────────────
    const stored = await redis.get(otpKey(userId));
    if (!stored) {
      res = NextResponse.json({ error: 'OTP expired or not sent. Request a new code.' }, { status: 400 });
      logger.logAPI(req, res, { className: 'EnrollVerifyParentOtpAPI', methodName: 'POST' }, start);
      return res;
    }

    // ── Constant-time comparison ──────────────────────────────────────────────
    const valid = constantTimeCompare(otp, stored);

    if (!valid) {
      const attempts = await redis.incr(attemptsKey(userId));
      if (attempts === 1) await redis.expire(attemptsKey(userId), LOCKOUT_TTL_SECONDS);
      if (attempts >= MAX_ATTEMPTS) {
        await redis.set(lockKey(userId), '1', 'EX', LOCKOUT_TTL_SECONDS);
        await redis.del(otpKey(userId));
        res = NextResponse.json(
          { error: 'Too many incorrect attempts. Request a new code in 1 hour.' },
          { status: 429 },
        );
        logger.logAPI(req, res, { className: 'EnrollVerifyParentOtpAPI', methodName: 'POST' }, start);
        return res;
      }
      const remaining = MAX_ATTEMPTS - Number(attempts);
      res = NextResponse.json(
        { error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` },
        { status: 400 },
      );
      logger.logAPI(req, res, { className: 'EnrollVerifyParentOtpAPI', methodName: 'POST' }, start);
      return res;
    }

    // ── OTP valid -- clean up Redis + mark verified ────────────────────────────
    await Promise.all([
      redis.del(otpKey(userId)),
      redis.del(attemptsKey(userId)),
    ]);

    await prisma.user.update({
      where: { id: userId },
      data: { parentVerifiedAt: new Date(), parentPhoneVerifiedAt: new Date() },
    });
    try {
      await invalidateUserSessionCache((session?.user as any)?.email);
    } catch (e) {
      logger.warn('enroll.verify-parent-otp: cache invalidation failed', { className: 'EnrollVerifyParentOtpAPI', methodName: 'POST', error: String(e) });
    }

    logger.info('enroll/verify-parent-otp: consent verified', {
      className: 'EnrollVerifyParentOtpAPI',
      methodName: 'POST',
      userId,
    });

    res = NextResponse.json({ ok: true, verified: true });
    logger.logAPI(req, res, { className: 'EnrollVerifyParentOtpAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('/api/enroll/verify-parent-otp error', { className: 'EnrollVerifyParentOtpAPI', methodName: 'POST', error: err });
    res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'EnrollVerifyParentOtpAPI', methodName: 'POST' }, start);
    return res;
  }
}
