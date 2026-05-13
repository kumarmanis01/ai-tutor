import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';

export async function POST() {
  const session = await getServerSessionForHandlers();
  if (!session) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });

  try {
    await prisma.systemSetting.upsert({
      where: { key: 'AI_PAUSED' },
      update: { value: true },
      create: { key: 'AI_PAUSED', value: true },
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'ContentEngine',
        targetId: 'global',
        action: 'FEATURE_FLAG_CHANGE',
        newValue: { paused: true },
      },
    });

    logger.info('[content-engine/pause] Engine paused', {
      event: 'engine_pause',
      context: { adminId: session.user.id },
    });

    void emitServerAnalyticsEvent(
      {
        eventType: ANALYTICS_EVENTS.ADMIN.HEALTH_CHANGES,
        userId: session.user.id,
        metadata: { paused: true },
      },
      'api.admin.content-engine.pause',
    );

    return NextResponse.json({ ok: true, paused: true });
  } catch (err) {
    logger.error('[content-engine/pause] Failed to pause engine', {
      event: 'engine_pause_error',
      context: { error: String(err) },
    });
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed to pause engine' }, { status: 500 });
  }
}
