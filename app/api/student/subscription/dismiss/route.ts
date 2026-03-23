/**
 * GET  /api/student/subscription/dismiss -- check if student dismissed the upgrade gate
 * POST /api/student/subscription/dismiss -- record dismissal (TTL 24 h)
 *
 * Redis key: upgrade:dismissed:{studentId}  TTL 86400 s
 * Auth: session required -- 401 before any DB/Redis query.
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

const DISMISS_TTL = 86_400; // 24 h in seconds

function dismissKey(studentId: string) {
  return `upgrade:dismissed:${studentId}`;
}

export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ dismissed: false }, { status: 200 });
    }
    const val = await redis.get(dismissKey(userId));
    return NextResponse.json({ dismissed: val === '1' }, { status: 200 });
  } catch (err) {
    logger.error('Dismiss GET failed', { event: 'subscription.dismiss.get_error', context: { userId }, err });
    return NextResponse.json({ dismissed: false }, { status: 200 });
  }
}

export async function POST() {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const redis = getRedis();
    if (redis) {
      await redis.set(dismissKey(userId), '1', 'EX', DISMISS_TTL);
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    logger.error('Dismiss POST failed', { event: 'subscription.dismiss.post_error', context: { userId }, err });
    // Gracefully succeed even if Redis is down -- dismiss is UX-only
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
