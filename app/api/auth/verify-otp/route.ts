import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { LanguageCode } from '@prisma/client';
import { encode } from 'next-auth/jwt';

function hashOtp(otp: string) {
  const secret = process.env.OTP_SECRET ?? 'fallback-secret';
  return crypto.createHash('sha256').update(`${otp}${secret}`).digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = String(body.phone || '').replace(/\D/g, '');
    const code = String(body.code || '').trim();

    if (!/^\d{7,15}$/.test(phone) || !/^\d{4,6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const codeHash = hashOtp(code);

    const record = await prisma.phoneOtp.findFirst({
      where: { phone, codeHash, consumed: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    await prisma.phoneOtp.update({ where: { id: record.id }, data: { consumed: true } });

    // find or create user by phone
    let user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({ data: { name: phone, phone, language: LanguageCode.en } });
    }

    // Create a NextAuth JWT and set it as the session cookie so client is signed in
    try {
      const tokenData = { name: user.name, email: user.email, sub: user.id } as any;
      const jwt = await encode({ secret: process.env.NEXTAUTH_SECRET as string, token: tokenData });

      const maxAge = 60 * 60 * 24 * 30; // 30 days
      const cookieValue = `next-auth.session-token=${jwt}; Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=Lax${
        process.env.NODE_ENV === 'production' ? '; Secure' : ''
      }`;

      return new Response(JSON.stringify({ ok: true, userId: user.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookieValue },
      });
    } catch {
      // fallback: return success without session cookie
      return NextResponse.json({ ok: true, userId: user.id });
    }
  } catch (err) {
    logger.error('verify-otp error', { className: 'api.auth.verify-otp', methodName: 'POST', error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
