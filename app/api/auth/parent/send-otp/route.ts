/**
 * FILE OBJECTIVE:
 * - POST /api/auth/parent/send-otp
 * - Sends a 6-digit OTP to all parent contact channels on file for the student:
 *   email (if parentEmail set) and/or WhatsApp (if whatsappPhone or parentPhone set).
 * - At least one channel must be configured before calling; returns 400 otherwise.
 * - No SMS. All notifications go via email or WhatsApp.
 *
 * EDIT LOG:
 * - 2026-05-05 | staff-engineer | replace SMS with email OTP (no SMS policy)
 * - 2026-05-05 | staff-engineer | send to all available channels (email + WhatsApp)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMailSafe } from '@/lib/mailer';
import { sendWhatsAppSafe } from '@/lib/whatsapp/sender';
import { parentOtpHtml } from '@/lib/email/templates';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { getServerSessionForHandlers } from '@/lib/session';
import { checkAuthRateLimit, createRateLimitResponse } from '@/lib/middleware/authRateLimit';
import { MAIL_SUBJECTS } from '@/lib/constants/mail';

const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS ?? 300);

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function hashOtp(otp: string) {
  const secret = process.env.OTP_SECRET ?? 'fallback-secret';
  return crypto.createHash('sha256').update(`${otp}${secret}`).digest('hex');
}

/** Stable OTP key for PhoneOtp table. Prefers WhatsApp/phone; falls back to email-derived key. */
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

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { parentEmail: true, parentPhone: true, whatsappPhone: true, name: true },
    });

    const parentEmail = student?.parentEmail?.trim() ?? '';
    const whatsappPhone = student?.whatsappPhone?.trim() ?? '';
    const parentPhone = student?.parentPhone?.trim() ?? '';

    const hasEmail = parentEmail.includes('@');
    const hasWhatsapp = whatsappPhone.replace(/\D/g, '').length >= 10
      || parentPhone.replace(/\D/g, '').length >= 10;

    if (!hasEmail && !hasWhatsapp) {
      return NextResponse.json(
        { error: 'Add a parent email or WhatsApp number before sending a verification code.' },
        { status: 400 },
      );
    }

    // Rate limit by student
    const rateLimitResult = await checkAuthRateLimit(req, 'sendCode', `parent:${studentId}`);
    if (!rateLimitResult.allowed) return createRateLimitResponse(rateLimitResult);

    const otpKey = deriveOtpKey(whatsappPhone, parentPhone, parentEmail);

    // DB-based rate limit: max 5 active OTPs in last 15 minutes
    const recentCount = await prisma.phoneOtp.count({
      where: { phone: otpKey, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
    });
    if (recentCount >= 5) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const otp = generateOtp();
    const codeHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);
    const ip = req.headers.get('x-forwarded-for') || 'unknown';

    await prisma.phoneOtp.create({
      data: { phone: otpKey, codeHash, expiresAt, ip, userId: studentId },
    });

    const studentName = student?.name || 'your child';
    const sentTo: { email?: string; whatsapp?: string } = {};

    // Send to email if available
    if (hasEmail) {
      await sendMailSafe({
        to: parentEmail,
        subject: MAIL_SUBJECTS.PARENT_OTP,
        html: parentOtpHtml(otp, studentName),
      });
      sentTo.email = parentEmail;
    }

    // Send to WhatsApp if available
    const waPhone = whatsappPhone.replace(/\D/g, '') || parentPhone.replace(/\D/g, '');
    if (hasWhatsapp && waPhone) {
      const waMessage = `Your Spinzy Academy parent verification code for ${studentName} is: ${otp}. Valid for ${Math.round(OTP_EXPIRY_SECONDS / 60)} minutes.`;
      await sendWhatsAppSafe(waPhone, waMessage);
      sentTo.whatsapp = `+${waPhone.startsWith('91') ? '' : ''}${waPhone}`;
    }

    const res = NextResponse.json({ ok: true, expiresInSeconds: OTP_EXPIRY_SECONDS, sentTo });
    logger.logAPI(req, res, { className: 'api.auth.parent.send-otp', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('parent send-otp error', { className: 'api.auth.parent.send-otp', methodName: 'POST', error: err });
    const res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'api.auth.parent.send-otp', methodName: 'POST' }, start);
    return res;
  }
}
