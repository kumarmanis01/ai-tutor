import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LanguageCode } from '@prisma/client';
import { cookies } from 'next/headers';
import { sendEmail } from '@/lib/mailer';
import { logApiUsage } from '@/utils/logApiUsage';

export async function POST(req: Request) {
  logApiUsage('/api/auth/verify-code', 'POST');
  const { email, code } = await req.json();

  if (
    !email ||
    !code ||
    typeof email !== 'string' ||
    typeof code !== 'string' ||
    code.length !== 6
  ) {
    return NextResponse.json({ error: 'Missing or invalid email/code' }, { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Find the verification token using compound key
  const tokenRecord = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: cleanEmail, token: code } },
  });

  if (!tokenRecord || tokenRecord.expires < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
  }

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: cleanEmail, name: cleanEmail.split('@')[0], language: LanguageCode.en },
    });
    // Optionally, send welcome email using centralized mailer
    try {
      await sendEmail({
        to: cleanEmail,
        subject: 'Welcome to Spinzy Academy',
        text: `Hello ${user.name}, your account has been created successfully!`,
        html: `<p>Hello <b>${user.name}</b>, your account has been created successfully!</p>`,
      });
    } catch (err) {
      logger.error('Error sending welcome email', { className: 'api.auth.verify-code', methodName: 'POST', error: err });
      // You may choose to ignore or handle this error
    }
  }

  // Mark email as verified
  await prisma.user.update({
    where: { email: cleanEmail },
    data: { emailVerified: new Date() },
  });

  // Delete the used token
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: cleanEmail, token: code } },
  });

  // Set a session cookie (replace with your session logic)
  const cookieStore = await cookies();
  cookieStore.set('user', user.id, { httpOnly: true, path: '/' });

  return NextResponse.json({ success: true, userId: user.id, email: user.email, name: user.name });
}
