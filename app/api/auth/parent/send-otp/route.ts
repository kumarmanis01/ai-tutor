import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendSms } from '@/lib/sms';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { getServerSessionForHandlers } from '@/lib/session';
import { checkAuthRateLimit, createRateLimitResponse } from '@/lib/middleware/authRateLimit';

const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS ?? 300);

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function hashOtp(otp: string) {
  const secret = process.env.OTP_SECRET ?? 'fallback-secret';
  return crypto.createHash('sha256').update(`${otp}${secret}`).digest('hex');
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const studentId = session?.user?.id ? String(session.user.id) : null;
    if (!studentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const rawPhone = String(body.parentPhone || '');
    const parentPhone = rawPhone.replace(/\D/g, '');
    if (!/^\d{7,15}$/.test(parentPhone)) {
      return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
    }

    // Rate limit by phone (and IP via middleware)
    const rateLimitResult = await checkAuthRateLimit(req, 'sendCode', `parent:${parentPhone}`);
    if (!rateLimitResult.allowed) return createRateLimitResponse(rateLimitResult);

    // Backup DB-based rate limit: max 5 active OTPs in last 15 minutes per phone
    const recentCount = await prisma.phoneOtp.count({
      where: {
        phone: parentPhone,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (recentCount >= 5) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Persist phone on user (unverified) and ensure account is gated until verify
    await prisma.user.update({
      where: { id: studentId },
      data: {
        parentPhone,
        accountStatus: 'pending_parent_verification',
      },
    });

    const otp = generateOtp();
    const codeHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);
    const ip = req.headers.get('x-forwarded-for') || 'unknown';

    await prisma.phoneOtp.create({
      data: { phone: parentPhone, codeHash, expiresAt, ip, userId: studentId },
    });

    await sendSms(
      parentPhone,
      `Spinzy parent verification code: ${otp}. It expires in ${Math.round(OTP_EXPIRY_SECONDS / 60)} minutes.`
    );

    const res = NextResponse.json({ ok: true, expiresInSeconds: OTP_EXPIRY_SECONDS });
    logger.logAPI(req, res, { className: 'api.auth.parent.send-otp', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('parent send-otp error', {
      className: 'api.auth.parent.send-otp',
      methodName: 'POST',
      error: err,
    });
    const res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'api.auth.parent.send-otp', methodName: 'POST' }, start);
    return res;
  }
}
