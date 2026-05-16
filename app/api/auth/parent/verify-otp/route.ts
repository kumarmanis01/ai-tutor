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
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { getServerSessionForHandlers } from '@/lib/session';
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
