/**
 * FILE OBJECTIVE:
 * - POST /api/auth/parent/send-otp
 * - Sends a 6-digit OTP to the parent's email address (not SMS -- Spinzy Academy
 *   does not send SMS; all notifications go via email or WhatsApp).
 * - Requires the student to have a parentEmail on their profile before calling.
 *
 * EDIT LOG:
 * - 2026-05-05 | staff-engineer | replace SMS with email OTP (no SMS policy)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMailSafe } from '@/lib/mailer';
import { parentOtpHtml } from '@/lib/email/templates';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { getServerSessionForHandlers } from '@/lib/session';
import { checkAuthRateLimit, createRateLimitResponse } from '@/lib/middleware/authRateLimit';
import { MAIL_FROM, MAIL_SUBJECTS } from '@/lib/constants/mail';

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

    // Load student to get parentEmail and parentPhone (used for phoneOtp record key)
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { parentEmail: true, parentPhone: true, name: true },
    });

    const parentEmail = student?.parentEmail?.trim() ?? '';
    if (!parentEmail || !parentEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Parent email is required before sending OTP. Please add a parent email first.' },
        { status: 400 },
      );
    }

    // Use parentPhone as the phoneOtp key if available; fall back to a derived key from email.
    // This preserves the existing PhoneOtp table schema without a migration.
    const body = await req.json().catch(() => ({}));
    const rawPhone = String(body.parentPhone || student?.parentPhone || '');
    const parentPhone = rawPhone.replace(/\D/g, '') || `email:${Buffer.from(parentEmail).toString('base64').slice(0, 15)}`;

    // Rate limit by email
    const rateLimitResult = await checkAuthRateLimit(req, 'sendCode', `parent:${parentEmail}`);
    if (!rateLimitResult.allowed) return createRateLimitResponse(rateLimitResult);

    // DB-based rate limit: max 5 active OTPs in last 15 minutes
    const recentCount = await prisma.phoneOtp.count({
      where: {
        phone: parentPhone,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (recentCount >= 5) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Persist phone on user (unverified) if provided
    if (rawPhone.replace(/\D/g, '').length >= 10) {
      await prisma.user.update({
        where: { id: studentId },
        data: { parentPhone: rawPhone.replace(/\D/g, '') },
      });
    }

    const otp = generateOtp();
    const codeHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);
    const ip = req.headers.get('x-forwarded-for') || 'unknown';

    await prisma.phoneOtp.create({
      data: { phone: parentPhone, codeHash, expiresAt, ip, userId: studentId },
    });

    // Send OTP via email (no SMS)
    const studentName = student?.name || 'your child';
    await sendMailSafe({
      from: MAIL_FROM,
      to: parentEmail,
      subject: MAIL_SUBJECTS.PARENT_OTP,
      html: parentOtpHtml(otp, studentName),
    });

    const res = NextResponse.json({ ok: true, expiresInSeconds: OTP_EXPIRY_SECONDS, sentTo: parentEmail });
    logger.logAPI(req, res, { className: 'api.auth.parent.send-otp', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('parent send-otp error', { className: 'api.auth.parent.send-otp', methodName: 'POST', error: err });
    const res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'api.auth.parent.send-otp', methodName: 'POST' }, start);
    return res;
  }
}
