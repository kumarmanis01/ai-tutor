/**
 * FILE OBJECTIVE:
 * - POST /api/auth/parent/send-otp
 * - Sends a 6-digit OTP to parent contact channels on file for the student:
 *   email (if parentEmail set) and/or WhatsApp (if parentWhatsappPhone set).
 * - At least one channel must be configured before calling; returns 400 otherwise.
 * - Supports optional channel-specific dispatch via body { channel: 'email' | 'whatsapp' }.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/auth/parent/send-otp.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EMAIL INFRA POLICY: All email sends must use lib/mail.ts (sendEmail, sendEmailBatch, sendEmailUnified, sendEmailUnifiedSafe). No direct sendMail/sendMailSafe allowed.
import { sendEmailUnifiedSafe } from '@/lib/mail';
import { parentOtpHtml } from '@/lib/email/templates';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { getServerSessionForHandlers } from '@/lib/session';
import { checkAuthRateLimit, createRateLimitResponse } from '@/lib/middleware/authRateLimit';
import { MAIL_SUBJECTS } from '@/lib/constants/mail';
import { channelOtpKeyByType, getParentChannelVerificationStatus, resolveParentChannels } from '@/lib/parent/contactLinking';

const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS ?? 300);

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function hashOtp(otp: string) {
  const secret = process.env.OTP_SECRET ?? 'fallback-secret';
  return crypto.createHash('sha256').update(`${otp}${secret}`).digest('hex');
}

type OtpChannel = 'email' | 'whatsapp';

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const studentId = session?.user?.id ? String(session.user.id) : null;
    if (!studentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const requestedChannel = body?.channel === 'email' || body?.channel === 'whatsapp'
      ? (body.channel as OtpChannel)
      : null;

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { parentEmail: true, parentWhatsappPhone: true, name: true },
    });

    const parentEmail = student?.parentEmail?.trim() ?? '';
    const parentWhatsappPhone = student?.parentWhatsappPhone?.trim() ?? '';
    const channels = resolveParentChannels(parentEmail, parentWhatsappPhone, null);
    const hasEmail = channels.hasEmail;
    const hasWhatsapp = channels.hasWhatsapp;

    if (!hasEmail && !hasWhatsapp) {
      return NextResponse.json(
        { error: 'Add a parent email or WhatsApp number before sending a verification code.' },
        { status: 400 },
      );
    }

    if (requestedChannel === 'email' && !hasEmail) {
      return NextResponse.json({ error: 'Parent email is not configured.' }, { status: 400 });
    }
    if (requestedChannel === 'whatsapp' && !hasWhatsapp) {
      return NextResponse.json({ error: 'Parent WhatsApp is not configured.' }, { status: 400 });
    }

    // Rate limit by student
    const rateLimitResult = await checkAuthRateLimit(req, 'sendCode', `parent:${studentId}`);
    if (!rateLimitResult.allowed) return createRateLimitResponse(rateLimitResult);

    const targetChannels: OtpChannel[] = requestedChannel
      ? [requestedChannel]
      : (['email', 'whatsapp'] as OtpChannel[]).filter((channel) =>
          channel === 'email' ? hasEmail : hasWhatsapp,
        );

    const studentName = student?.name || 'your child';
    const sentTo: { email?: string; whatsapp?: string } = {};
    const ip = req.headers.get('x-forwarded-for') || 'unknown';

    for (const channel of targetChannels) {
      const otp = generateOtp();
      const codeHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);
      const otpKey = channelOtpKeyByType(channel, channels.normalizedEmail, channels.resolvedWhatsappDigits);

      const recentCount = await prisma.phoneOtp.count({
        where: { phone: otpKey, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
      });
      if (recentCount >= 5) {
        return NextResponse.json({ error: `Too many requests for ${channel}` }, { status: 429 });
      }

      await prisma.phoneOtp.create({
        data: { phone: otpKey, codeHash, expiresAt, ip, userId: studentId },
      });

      if (channel === 'email') {
        await sendEmailUnifiedSafe({
          mode: 'raw',
          delivery: 'best_effort',
          to: parentEmail,
          subject: MAIL_SUBJECTS.PARENT_OTP,
          html: parentOtpHtml(otp, studentName),
          reason: 'parent_otp',
        });
        sentTo.email = parentEmail;
      } else {
        const waMessage = `Your Spinzy Academy parent verification code for ${studentName} is: ${otp}. Valid for ${Math.round(OTP_EXPIRY_SECONDS / 60)} minutes.`;
        await sendWhatsAppSafe(channels.resolvedWhatsappDigits, waMessage);
        sentTo.whatsapp = channels.resolvedWhatsappDigits;
      }
    }

    const verification = await getParentChannelVerificationStatus({
      prisma,
      studentId,
      parentEmail: student?.parentEmail,
      whatsappPhone: student?.parentWhatsappPhone,
    });

    const res = NextResponse.json({ sent: true, ok: true, expiresInSeconds: OTP_EXPIRY_SECONDS, sentTo, verification });
    logger.logAPI(req, res, { className: 'api.auth.parent.send-otp', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('parent send-otp error', { className: 'api.auth.parent.send-otp', methodName: 'POST', error: err });
    const res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'api.auth.parent.send-otp', methodName: 'POST' }, start);
    return res;
  }
}

/**
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | add channel-specific OTP key generation and remove parentPhone fallback
 * - 2026-05-05 | staff-engineer | replace SMS with email OTP (no SMS policy)
 * - 2026-05-05 | staff-engineer | send to all available channels (email + WhatsApp)
 * - 2026-05-20T00:00:00Z | copilot | refactor: use centralized sendEmailUnifiedSafe (lib/mail), remove direct sendMailSafe per infra policy
 */
