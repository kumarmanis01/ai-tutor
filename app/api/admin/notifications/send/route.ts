import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { sendPushSafe } from '@/lib/push/send';
import { sendMailSafe } from '@/lib/mailer';
import { sendWhatsAppSafe } from '@/lib/whatsapp/sender';
import { adminBroadcastEmailHtml } from '@/lib/email/templates';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const schema = z.object({
  userId: z.string().min(1),
  type: z.enum(['push', 'email', 'whatsapp']),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'Invalid request body' }, { status: 400 });
  }

  const { userId, type, title, body: msgBody } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, whatsappPhone: true },
    });
    if (!user) return NextResponse.json({ code: 'NOT_FOUND', message: 'User not found' }, { status: 404 });

    if (type === 'push') {
      await sendPushSafe(userId, { title, body: msgBody });
    } else if (type === 'email') {
      if (!user.email) {
        return NextResponse.json({ code: 'NO_EMAIL', message: 'User has no email address' }, { status: 400 });
      }
      await sendMailSafe({
        to: user.email,
        subject: title,
        html: adminBroadcastEmailHtml({ title, body: msgBody }),
      });
    } else {
      // whatsapp
      if (!user.whatsappPhone) {
        return NextResponse.json({ code: 'NO_WHATSAPP', message: 'User has no WhatsApp number on file' }, { status: 400 });
      }
      await sendWhatsAppSafe(user.whatsappPhone, `${title}\n\n${msgBody}`);
    }

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'User',
        targetId: userId,
        action: 'FEATURE_FLAG_CHANGE',
        newValue: { notification: { type, title } },
      },
    });

    logger.info('[notifications/send] Notification sent', {
      event: 'admin_notification_sent',
      context: { userId, type, adminId: session.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[notifications/send] Failed to send notification', {
      event: 'admin_notification_error',
      context: { userId, type, error: String(err) },
    });
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed to send notification' }, { status: 500 });
  }
}
