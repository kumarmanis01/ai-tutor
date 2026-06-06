/**
 * FILE OBJECTIVE:
 * - POST /api/auth/parent/verify-otp
 * - Verifies a 6-digit OTP sent to parent channels (email or WhatsApp).
 * - Body: { code: string, channel: 'email' | 'whatsapp' }.
 * - On success: marks the channel-specific verified timestamp and transitions accountStatus to 'active'.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/auth/parent/verify-otp.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | add channel-aware verification and per-channel verified timestamps
 * - 2026-05-17T00:00:00Z | reviewer | add verifyCode rate limiting to prevent OTP brute-force
 * - 2026-06-06T00:00:00Z | claude | reconcile accountStatus/parentVerifiedAt in alreadyVerified path
 *     and invalidate session cache so verified users are not stuck pending
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { getServerSessionForHandlers } from '@/lib/session';
import { invalidateUserSessionCache } from '@/lib/auth';
import { checkAuthRateLimit, createRateLimitResponse } from '@/lib/middleware/authRateLimit';
import { channelOtpKeyByType, getParentChannelVerificationStatus, resolveParentChannels } from '@/lib/parent/contactLinking';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';

function hashOtp(otp: string) {
  const secret = process.env.OTP_SECRET ?? 'fallback-secret';
  return crypto.createHash('sha256').update(`${otp}${secret}`).digest('hex');
}

type OtpChannel = 'email';

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const studentId = session?.user?.id ? String(session.user.id) : null;
    if (!studentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate-limit by student to prevent brute-force of short OTP codes.
    const rateLimitResult = await checkAuthRateLimit(req, 'verifyCode', `parent:${studentId}`);
    if (!rateLimitResult.allowed) return createRateLimitResponse(rateLimitResult);

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || body.otp || '').trim();
    // Only email verification is enabled for now. Reject WhatsApp attempts explicitly.
    if (body.channel === 'whatsapp') {
      return NextResponse.json({ error: 'WhatsApp verification is currently disabled' }, { status: 400 });
    }
    // Default to email when no channel is provided by the client.
    const channel: OtpChannel = 'email';

    if (!/^\d{4,6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        parentEmail: true,
        parentWhatsappPhone: true,
        parentEmailVerifiedAt: true,
        parentWhatsappVerifiedAt: true,
        parentVerifiedAt: true,
      },
    });

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only email channel supported: check email-verified flag
    const alreadyVerified = !!user.parentEmailVerifiedAt;
    if (alreadyVerified) {
      // Reconcile accountStatus / parentVerifiedAt -- these can drift out of sync with
      // parentEmailVerifiedAt if a previous verify-otp call partially succeeded or if
      // parentEmailVerifiedAt was set by another code path that didn't activate the
      // account. Without this, the student stays pending_parent_verification forever
      // and gets bounced back to onboarding every time they sign in.
      const needsActivation = (session?.user as { accountStatus?: string } | undefined)?.accountStatus !== 'active' || !user.parentVerifiedAt;
      if (needsActivation) {
        try {
          await prisma.user.update({
            where: { id: studentId },
            data: {
              accountStatus: 'active',
              ...(user.parentVerifiedAt ? {} : { parentVerifiedAt: new Date() }),
            },
          });
          try {
            await invalidateUserSessionCache((session?.user as any)?.email);
          } catch (e) {
            logger.warn('parent.verify-otp: cache invalidation failed (alreadyVerified path)', {
              className: 'api.auth.parent.verify-otp',
              methodName: 'POST',
              error: String(e),
            });
          }
        } catch (e) {
          logger.warn('parent.verify-otp: account reconciliation failed', {
            className: 'api.auth.parent.verify-otp',
            methodName: 'POST',
            studentId,
            error: String(e),
          });
        }
      }
      const verification = await getParentChannelVerificationStatus({
        prisma,
        studentId,
        parentEmail: user.parentEmail,
        whatsappPhone: user.parentWhatsappPhone,
      });
      const res = NextResponse.json({ ok: true, alreadyVerified: true, channel, verification });
      logger.logAPI(req, res, { className: 'api.auth.parent.verify-otp', methodName: 'POST' }, start);
      return res;
    }

    const parentEmail = user.parentEmail?.trim() ?? '';
    const parentWhatsappPhone = user.parentWhatsappPhone?.trim() ?? '';
    const channels = resolveParentChannels(parentEmail, parentWhatsappPhone, null);

    if (channel === 'email' && !channels.hasEmail) {
      return NextResponse.json({ error: 'Parent email is not configured' }, { status: 400 });
    }

    const otpKey = channelOtpKeyByType(channel, channels.normalizedEmail, channels.resolvedWhatsappDigits);
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
        data: {
          parentEmailVerifiedAt: new Date(),
          ...(user.parentVerifiedAt ? {} : { parentVerifiedAt: new Date() }),
          accountStatus: 'active',
        },
      }),
    ]);

    // Best-effort: invalidate short-lived session cache for this student so JWT reflects new accountStatus
    try {
      await invalidateUserSessionCache((session?.user as any)?.email);
    } catch (e) {
      logger.warn('parent.verify-otp: cache invalidation failed', { className: 'api.auth.parent.verify-otp', methodName: 'POST', error: String(e) });
    }

    const verification = await getParentChannelVerificationStatus({
      prisma,
      studentId,
      parentEmail: user.parentEmail,
      whatsappPhone: user.parentWhatsappPhone,
    });

    const res = NextResponse.json({ ok: true, verified: true, channel, verification });
    try {
      void emitServerAnalyticsEvent(
        {
          eventType: ANALYTICS_EVENTS.PARENT.CHANNEL_VERIFIED_CHANNEL,
          userId: studentId,
          metadata: { channel },
        },
        'api.auth.parent.verify-otp',
      );
    } catch {
      /* best-effort */
    }
    logger.logAPI(req, res, { className: 'api.auth.parent.verify-otp', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('parent verify-otp error', { className: 'api.auth.parent.verify-otp', methodName: 'POST', error: err });
    const res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'api.auth.parent.verify-otp', methodName: 'POST' }, start);
    return res;
  }
}
