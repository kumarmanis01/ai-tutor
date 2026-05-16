import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { resolveParentChannels, getParentChannelVerificationStatus, toEmailOtpKey, toWhatsappOtpKeys } from '@/lib/parent/contactLinking';
import { logger } from '@/lib/logger';

export async function GET() {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    const studentId = session?.user?.id ? String(session.user.id) : null;
    if (!studentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: studentId }, select: { parentEmail: true, parentWhatsappPhone: true } });
    const parentEmail = user?.parentEmail?.trim() ?? '';
    const parentWhatsappPhone = user?.parentWhatsappPhone?.trim() ?? '';

    const channels = resolveParentChannels(parentEmail, parentWhatsappPhone, null);

    const emailKey = channels.hasEmail ? toEmailOtpKey(channels.normalizedEmail) : null;
    const whatsappKeys = channels.hasWhatsapp ? toWhatsappOtpKeys(channels.resolvedWhatsappDigits) : [];

    // Look for any unconsumed, unexpired OTPs for these keys
    const now = new Date();
    const keysToCheck = [ ...(emailKey ? [emailKey] : []), ...whatsappKeys ];
    let sentTo: { email?: string; whatsapp?: string } = {};
    if (keysToCheck.length > 0) {
      const records = await prisma.phoneOtp.findMany({
        where: {
          userId: studentId,
          consumed: false,
          expiresAt: { gte: now },
          phone: { in: keysToCheck },
        },
        orderBy: { createdAt: 'desc' },
      });
      const phones = new Set(records.map((r) => r.phone));
      if (emailKey && phones.has(emailKey)) sentTo.email = channels.normalizedEmail;
      const waKey = whatsappKeys.find((k) => phones.has(k));
      if (waKey) sentTo.whatsapp = channels.resolvedWhatsappDigits;
    }

    const verification = await getParentChannelVerificationStatus({ prisma, studentId, parentEmail: user?.parentEmail, whatsappPhone: user?.parentWhatsappPhone });

    const res = NextResponse.json({ ok: true, sentTo, verification });
    logger.logAPI?.({} as any, res, { className: 'api.auth.parent.status', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('parent status error', { className: 'api.auth.parent.status', methodName: 'GET', error: String(err) });
    return NextResponse.json({ error: 'Failed to fetch parent OTP status' }, { status: 500 });
  }
}
