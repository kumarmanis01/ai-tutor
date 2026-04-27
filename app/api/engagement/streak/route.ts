import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getCurrentStreak } from '@/lib/engagement/engagementService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const CACHE_MAX_AGE = 60;
const CACHE_STALE = 120;

/**
 * GET /api/engagement/streak
 * Returns current and longest streak (consecutive days with ≥1 session).
 */
export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data = await getCurrentStreak(userId);
    const res = NextResponse.json(data);
    res.headers.set(
      'Cache-Control',
      `private, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_STALE}`,
    );
    return res;
  } catch (err) {
    logger.warn('engagement.streak.error', { userId, error: err });
    return NextResponse.json({ error: 'Failed to load streak' }, { status: 500 });
  }
}
