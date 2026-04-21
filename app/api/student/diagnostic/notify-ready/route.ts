/**
 * POST /api/student/diagnostic/notify-ready
 *
 * Registers the authenticated student's preference to be notified via email
 * when the diagnostic for a given subject becomes available.
 *
 * The preference is stored in Redis with a 30-day TTL.
 * The dailyMaintenance scheduler job checks these keys and emails the student
 * once questions are available for their subject.
 *
 * Body: { subjectId: string }
 * Auth: session required -- 401 if missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let subjectId: string | undefined;
  try {
    const body = await req.json();
    subjectId = typeof body?.subjectId === 'string' ? body.subjectId.trim() : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!subjectId) {
    return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    logger.warn('[notify-ready] Redis unavailable -- cannot store preference', {
      event: 'diagnostic.notify_ready.no_redis',
      context: { studentId: userId, subjectId },
    });
    return NextResponse.json({ error: 'Notification service unavailable' }, { status: 503 });
  }

  try {
    const key = `diagnostic:notify:${userId}:${subjectId}`;
    await (redis as any).set(key, '1', 'EX', TTL_SECONDS);
    logger.info('[notify-ready] preference stored', { event: 'diagnostic.notify_ready.stored', context: { studentId: userId, subjectId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[notify-ready] failed to store preference', {
      event: 'diagnostic.notify_ready.error',
      context: { studentId: userId, subjectId, error: String(err) },
    });
    return NextResponse.json({ error: 'Could not save preference' }, { status: 500 });
  }
}
