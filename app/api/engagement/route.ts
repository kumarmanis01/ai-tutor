import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import {
  getTodayCompletion,
  getCurrentStreak,
  getWeeklyActivity,
} from '@/lib/engagement/engagementService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const CACHE_MAX_AGE = 60;
const CACHE_STALE = 120;

/**
 * GET /api/engagement
 * Returns today goal, streak, and weekly activity in one response.
 * Use this from the dashboard to avoid three round-trips.
 */
export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [today, streak, weekly] = await Promise.all([
      getTodayCompletion(userId),
      getCurrentStreak(userId),
      getWeeklyActivity(userId),
    ]);
    const data = { today, streak, weekly };
    const res = NextResponse.json(data);
    res.headers.set(
      'Cache-Control',
      `private, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_STALE}`
    );
    return res;
  } catch (err) {
    logger.warn('engagement.combined.error', { userId, error: err });
    return NextResponse.json({ error: 'Failed to load engagement' }, { status: 500 });
  }
}
