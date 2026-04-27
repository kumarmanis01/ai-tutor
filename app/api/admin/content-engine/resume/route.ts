import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST() {
  const session = await getServerSessionForHandlers();
  if (!session) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });

  try {
    await prisma.systemSetting.upsert({
      where: { key: 'AI_PAUSED' },
      update: { value: false },
      create: { key: 'AI_PAUSED', value: false },
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        targetEntity: 'ContentEngine',
        targetId: 'global',
        action: 'FEATURE_FLAG_CHANGE',
        newValue: { paused: false },
      },
    });

    logger.info('[content-engine/resume] Engine resumed', {
      event: 'engine_resume',
      context: { adminId: session.user.id },
    });

    return NextResponse.json({ ok: true, paused: false });
  } catch (err) {
    logger.error('[content-engine/resume] Failed to resume engine', {
      event: 'engine_resume_error',
      context: { error: String(err) },
    });
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Failed to resume engine' }, { status: 500 });
  }
}
