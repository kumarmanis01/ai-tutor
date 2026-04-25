import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { sendPushSafe } from '@/lib/push/send';
import { sendMailSafe } from '@/lib/mailer';
import { sendWhatsAppSafe } from '@/lib/whatsapp/sender';
import { adminBroadcastEmailHtml } from '@/lib/email/templates';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const audienceSchema = z.union([
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('grade'), grade: z.number().int().min(6).max(12) }),
  z.object({ type: z.literal('inactive'), days: z.number().int().min(1).max(90) }),
]);

const schema = z.object({
  audience: audienceSchema,
  type: z.enum(['push', 'email', 'whatsapp']),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
});

async function resolveUserIds(audience: z.infer<typeof audienceSchema>): Promise<string[]> {
  if (audience.type === 'all') {
    const users = await prisma.user.findMany({ where: { role: 'user' }, select: { id: true } });
    return users.map((u) => u.id);
  }
  if (audience.type === 'grade') {
    const users = await prisma.user.findMany({
      where: { role: 'user', grade: String(audience.grade) },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
  // inactive
  const since = new Date(Date.now() - audience.days * 86_400_000);
  const activeIds = await prisma.learningSession
    .findMany({
      where: { startedAt: { gte: since } },
      select: { studentId: true },
      distinct: ['studentId'],
    })
    .then((rows) => rows.map((r) => r.studentId));

  const users = await prisma.user.findMany({
    where: { role: 'user', id: { notIn: activeIds } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session)
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin')
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { audience, type, title, body: msgBody } = parsed.data;

  try {
    const userIds = await resolveUserIds(audience);

    void prisma.notificationLog
      .create({
        data: {
          audience: audience.type,
          channel: type,
          title,
          body: msgBody,
          sentTo: userIds.length,
          status: 'sent',
          adminId: session.user.id,
        },
      })
      .catch(() => {});

    if (type === 'push') {
      for (const userId of userIds) {
        void sendPushSafe(userId, { title, body: msgBody });
      }
    } else if (type === 'email') {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds }, email: { not: null } },
        select: { email: true },
      });
      const html = adminBroadcastEmailHtml({ title, body: msgBody });
      for (const user of users) {
        if (user.email) {
          void sendMailSafe({ to: user.email, subject: title, html });
        }
      }
    } else {
      // whatsapp broadcast -- only reaches users who have provided a number
      const users = await prisma.user.findMany({
        where: { id: { in: userIds }, whatsappPhone: { not: null } },
        select: { whatsappPhone: true },
      });
      for (const user of users) {
        if (user.whatsappPhone) {
          void sendWhatsAppSafe(user.whatsappPhone, `${title}\n\n${msgBody}`);
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'User',
        targetId: 'broadcast',
        action: 'FEATURE_FLAG_CHANGE',
        newValue: { broadcast: { audience, type, title, queued: userIds.length } },
      },
    });

    logger.info('[notifications/broadcast] Broadcast sent', {
      event: 'admin_broadcast_sent',
      context: {
        audienceType: audience.type,
        type,
        queued: userIds.length,
        adminId: session.user.id,
      },
    });

    return NextResponse.json({ ok: true, queued: userIds.length });
  } catch (err) {
    logger.error('[notifications/broadcast] Failed', {
      event: 'admin_broadcast_error',
      context: { error: String(err) },
    });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to send broadcast' },
      { status: 500 }
    );
  }
}
