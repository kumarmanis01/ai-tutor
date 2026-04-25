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

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const studentId = session?.user?.id ? String(session.user.id) : null;
    if (!studentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const rawPhone = String(body.parentPhone || '');
    const parentPhone = rawPhone.replace(/\D/g, '');
    const code = String(body.code || '').trim();

    if (!/^\d{7,15}$/.test(parentPhone) || !/^\d{4,6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { parentPhone: true, parentPhoneVerifiedAt: true },
    });
    if (!user?.parentPhone || user.parentPhone.replace(/\D/g, '') !== parentPhone) {
      return NextResponse.json({ error: 'Parent phone mismatch' }, { status: 400 });
    }
    if (user.parentPhoneVerifiedAt) {
      const res = NextResponse.json({ ok: true, alreadyVerified: true });
      logger.logAPI(
        req,
        res,
        { className: 'api.auth.parent.verify-otp', methodName: 'POST' },
        start
      );
      return res;
    }

    const codeHash = hashOtp(code);
    const record = await prisma.phoneOtp.findFirst({
      where: {
        phone: parentPhone,
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
    logger.error('parent verify-otp error', {
      className: 'api.auth.parent.verify-otp',
      methodName: 'POST',
      error: err,
    });
    const res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'api.auth.parent.verify-otp', methodName: 'POST' }, start);
    return res;
  }
}
