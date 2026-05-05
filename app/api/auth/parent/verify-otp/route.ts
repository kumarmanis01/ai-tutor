/**
 * FILE OBJECTIVE:
 * - POST /api/auth/parent/verify-otp
 * - Verifies a 6-digit OTP sent to parent channels (email or WhatsApp).
 * - Body: { code: string }  (no phone required -- key derived server-side)
 * - On success: sets parentPhoneVerifiedAt (used as "parent verified" flag) and
 *   transitions accountStatus to 'active'.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { getServerSessionForHandlers } from '@/lib/session';

function hashOtp(otp: string) {
  const secret = process.env.OTP_SECRET ?? 'fallback-secret';
  return crypto.createHash('sha256').update(`${otp}${secret}`).digest('hex');
}

/** Must match the key derivation in send-otp/route.ts exactly. */
function deriveOtpKey(whatsappPhone: string, parentPhone: string, parentEmail: string): string {
  const wa = whatsappPhone.replace(/\D/g, '');
  if (wa.length >= 10) return wa;
  const ph = parentPhone.replace(/\D/g, '');
  if (ph.length >= 10) return ph;
  return `email:${Buffer.from(parentEmail).toString('base64').slice(0, 20)}`;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const studentId = session?.user?.id ? String(session.user.id) : null;
    if (!studentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '').trim();

    if (!/^\d{4,6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { parentEmail: true, parentPhone: true, whatsappPhone: true, parentPhoneVerifiedAt: true },
    });

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.parentPhoneVerifiedAt) {
      const res = NextResponse.json({ ok: true, alreadyVerified: true });
      logger.logAPI(req, res, { className: 'api.auth.parent.verify-otp', methodName: 'POST' }, start);
      return res;
    }

    const parentEmail = user.parentEmail?.trim() ?? '';
    const whatsappPhone = user.whatsappPhone?.trim() ?? '';
    const parentPhone = user.parentPhone?.trim() ?? '';
    const otpKey = deriveOtpKey(whatsappPhone, parentPhone, parentEmail);
    const codeHash = hashOtp(code);

    const record = await prisma.phoneOtp.findFirst({
      where: {
        phone: otpKey,
        codeHash,
        consumed: false,
        expiresAt: { gte: new Date() },
        userId: studentId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.phoneOtp.update({ where: { id: record.id }, data: { consumed: true } }),
      prisma.user.update({
        where: { id: studentId },
        data: { parentPhoneVerifiedAt: new Date(), accountStatus: 'active' },
      }),
    ]);

    const res = NextResponse.json({ ok: true });
    logger.logAPI(req, res, { className: 'api.auth.parent.verify-otp', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('parent verify-otp error', { className: 'api.auth.parent.verify-otp', methodName: 'POST', error: err });
    const res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'api.auth.parent.verify-otp', methodName: 'POST' }, start);
    return res;
  }
}
