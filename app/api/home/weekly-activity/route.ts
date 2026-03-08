import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/home/weekly-activity
 *
 * Returns which days this week (Mon–Sun) had at least one learning session.
 * Used to render the visual streak calendar on the dashboard.
 *
 * Response:
 *   { activeDays: boolean[7] }  // index 0 = Monday, 6 = Sunday
 *   { todayIndex: number }      // 0–6, which slot is today
 */
export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'WeeklyActivityAPI', methodName: 'GET' }, start);
    return res;
  }

  try {
    // Determine Monday of this week (ISO week)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const isoDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon, 6=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - isoDay);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);

    // Query structured sessions started this week
    const sessions = await prisma.structuredSession.findMany({
      where: {
        studentId: user.id,
        startedAt: { gte: monday, lt: sunday },
      },
      select: { startedAt: true },
    });

    // Build 7-element array (Mon=0 … Sun=6)
    const activeDays = Array(7).fill(false) as boolean[];
    for (const s of sessions) {
      const d = s.startedAt.getDay(); // 0=Sun
      const idx = d === 0 ? 6 : d - 1;
      activeDays[idx] = true;
    }

    res = NextResponse.json({ activeDays, todayIndex: isoDay });
  } catch (err) {
    logger.error('WeeklyActivityAPI.error', { userId: user.id, error: err });
    res = NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  logger.logAPI(req, res, { className: 'WeeklyActivityAPI', methodName: 'GET' }, start);
  return res;
}
