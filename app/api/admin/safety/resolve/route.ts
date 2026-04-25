/**
 * POST /api/admin/safety/resolve
 * Marks a SafetyEvent or QuestionFlag as resolved.
 * Auth: admin role required.
 */
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { id, kind } = body ?? {};
  if (!id || !kind) {
    return NextResponse.json({ error: 'id and kind required' }, { status: 400 });
  }

  try {
    if (kind === 'distress') {
      await prisma.safetyEvent.update({
        where: { id },
        data: { resolvedAt: new Date(), resolution: `Resolved by admin ${session.user.id}` },
      });
    } else if (kind === 'flag') {
      await prisma.questionFlag.update({
        where: { id },
        data: { status: 'resolved', resolvedAt: new Date() },
      });
    } else {
      return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
    }

    logger.info('[admin/safety/resolve] Event resolved', {
      event: 'safety_event_resolved',
      context: { id, kind, adminId: session.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[admin/safety/resolve] Failed', { err });
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}
