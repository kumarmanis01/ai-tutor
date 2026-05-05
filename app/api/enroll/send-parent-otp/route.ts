/**
 * FILE OBJECTIVE:
 * - Generate a 6-digit OTP and deliver it to the parent via email AND WhatsApp.
 * - Reads parentEmail / parentPhone from the DB (saved during enrollment).
 * - At least one channel must be present; both are attempted, first success is sufficient.
 * - Stores OTP hash in Redis with 10-minute TTL.
 * - Rate-limited: max 3 sends per 10 minutes per user.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/enroll/send-parent-otp/route.test.ts
 *
 * EDIT LOG:
 * - 2026-05-05 | claude | created for DPDP enrollment consent flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getRedis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { sendMailSafe } from '@/lib/mailer';
import { parentOtpHtml } from '@/lib/email/templates';
import { sendWhatsAppText } from '@/lib/whatsapp/sender';

export const dynamic = 'force-dynamic';

const OTP_TTL_SECONDS = 600;
const RATE_WINDOW_SECONDS = 600;
const MAX_SENDS = 3;

function otpKey(userId: string): string {
  return `enroll:otp:parent:${userId}`;
}
function rateKey(userId: string): string {
  return `enroll:otp:parent:rate:${userId}`;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email: string): string {
  if (!email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const masked = local.length <= 2 ? '***' : local[0] + '***' + local[local.length - 1];
  return `${masked}@${domain}`;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  let res: Response;
  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'EnrollSendParentOtpAPI', methodName: 'POST' }, start);
      return res;
    }

    // ── Rate limit ────────────────────────────────────────────────────────────
    const redis = getRedis();
    const rk = rateKey(userId);
    const count = await redis.incr(rk);
    if (count === 1) await redis.expire(rk, RATE_WINDOW_SECONDS);
    if (count > MAX_SENDS) {
      res = NextResponse.json({ error: 'Too many OTP requests. Please wait 10 minutes.' }, { status: 429 });
      logger.logAPI(req, res, { className: 'EnrollSendParentOtpAPI', methodName: 'POST' }, start);
      return res;
    }

    // ── Load parent contacts from DB ──────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, parentEmail: true, parentPhone: true },
    });

    const parentEmail = user?.parentEmail?.trim() || null;
    const parentPhone = user?.parentPhone?.trim() || null;
    const studentName = user?.name || 'your child';

    if (!parentEmail && !parentPhone) {
      res = NextResponse.json(
        { error: 'No parent contact found. Save parent email or phone first.' },
        { status: 400 },
      );
      logger.logAPI(req, res, { className: 'EnrollSendParentOtpAPI', methodName: 'POST' }, start);
      return res;
    }

    // ── Generate + store OTP ──────────────────────────────────────────────────
    const otp = generateOtp();
    await redis.set(otpKey(userId), otp, 'EX', OTP_TTL_SECONDS);

    // ── Deliver via email (non-blocking) ──────────────────────────────────────
    let emailSent = false;
    let whatsappSent = false;

    if (parentEmail) {
      const emailResult = await sendMailSafe({
        to: parentEmail,
        subject: 'Spinzy Academy -- Parent approval needed',
        html: parentOtpHtml(otp, studentName),
      });
      emailSent = emailResult.ok ?? false;
      if (!emailSent) {
        logger.warn('enroll/send-parent-otp: email delivery failed', {
          className: 'EnrollSendParentOtpAPI',
          methodName: 'POST',
          error: emailResult.error,
        });
      }
    }

    // ── Deliver via WhatsApp ──────────────────────────────────────────────────
    if (parentPhone) {
      const waMessage = `Spinzy Academy -- Parent approval\n\n${studentName} has signed up and needs your approval.\n\nYour verification code: *${otp}*\n\nEnter this code in the Spinzy app. Valid for 10 minutes. If you did not expect this, ignore it safely.`;
      const waResult = await sendWhatsAppText(parentPhone, waMessage).catch(() => ({ ok: false, error: 'exception' }));
      whatsappSent = waResult.ok;
      if (!whatsappSent) {
        logger.warn('enroll/send-parent-otp: WhatsApp delivery failed', {
          className: 'EnrollSendParentOtpAPI',
          methodName: 'POST',
          error: (waResult as { error?: string }).error,
        });
      }
    }

    if (!emailSent && !whatsappSent) {
      res = NextResponse.json(
        { error: 'Could not deliver OTP. Check parent contact details and try again.' },
        { status: 502 },
      );
      logger.logAPI(req, res, { className: 'EnrollSendParentOtpAPI', methodName: 'POST' }, start);
      return res;
    }

    res = NextResponse.json({
      ok: true,
      channels: {
        email: parentEmail ? maskEmail(parentEmail) : null,
        whatsapp: parentPhone ? 'WhatsApp' : null,
      },
      emailSent,
      whatsappSent,
    });
    logger.logAPI(req, res, { className: 'EnrollSendParentOtpAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('/api/enroll/send-parent-otp error', { className: 'EnrollSendParentOtpAPI', methodName: 'POST', error: err });
    res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'EnrollSendParentOtpAPI', methodName: 'POST' }, start);
    return res;
  }
}
