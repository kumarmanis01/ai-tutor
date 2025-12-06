import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendSms } from '@/lib/sms';

const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS ?? 300);

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function hashOtp(otp: string) {
  const secret = process.env.OTP_SECRET ?? 'fallback-secret';
  return crypto.createHash('sha256').update(`${otp}${secret}`).digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawPhone = String(body.phone || '');
    const phone = rawPhone.replace(/\D/g, '');
    if (!/^\d{7,15}$/.test(phone)) {
      return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
    }

    // Simple rate limit: max 5 active OTPs in last 15 minutes
    const recentCount = await prisma.phoneOtp.count({
      where: {
        phone,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (recentCount >= 5) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const otp = generateOtp();
    const codeHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);
    const ip = req.headers.get('x-forwarded-for') || 'unknown';

    await prisma.phoneOtp.create({
      data: { phone, codeHash, expiresAt, ip },
    });

    await sendSms(phone, `Your verification code is ${otp}. It expires in ${Math.round(OTP_EXPIRY_SECONDS/60)} minutes.`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('send-otp error', { className: 'api.auth.send-otp', methodName: 'POST', error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
