import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { logApiUsage } from '@/utils/logApiUsage';
import { logEvent } from '@/utils/logEvent';
import { getServerSessionForHandlers } from '@/lib/session';

type RequestBody = {
  badgeId?: string;
  ts?: number;
};

export async function POST(req: Request) {
  logApiUsage('/api/badges/share', 'POST');

  const raw = await req.json().catch(() => ({}) as unknown);
  const body = raw as RequestBody;
  const badgeId = typeof body.badgeId === 'string' ? body.badgeId : undefined;

  if (!badgeId) {
    return NextResponse.json({ error: 'badgeId required' }, { status: 400 });
  }

  const session = await getServerSessionForHandlers();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await logEvent('badge_shared', { badgeId });
  } catch (err) {
    logger.error('[badges/share] db write failed', { className: 'api.badges.share', methodName: 'POST', error: err });
    // non-blocking: return ok but log the error
    return NextResponse.json({ ok: true, warning: 'db_write_failed' });
  }

  const base =
    process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const shareUrl = `${base}/profile/${session.user.id}#badge-${badgeId}`;

  return NextResponse.json({ ok: true, shareUrl });
}
