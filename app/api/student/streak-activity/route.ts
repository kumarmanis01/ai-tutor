/**
 * GET /api/student/streak-activity
 *
 * Returns YYYY-MM-DD date strings for each of the last 7 days
 * on which the student had at least one qualifying session (state=COMPLETE).
 *
 * Used by StreakWidget to render the 7-day mini calendar.
 * Auth: session required -- 401 if missing.
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { isSessionEngineEnabled } from '@/lib/session/sessionEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authSession = await getServerSessionForHandlers();
  const userId = (authSession?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Start of 7 days ago (UTC midnight)
  const now = new Date();
  const sevenDaysAgoMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6);
  const sevenDaysAgo = new Date(sevenDaysAgoMs);

  let activeDates: string[] = [];

  try {
    if (isSessionEngineEnabled()) {
      const sessions = await prisma.structuredSession.findMany({
        where: {
          studentId: userId,
          state: 'COMPLETE',
          completedAt: { gte: sevenDaysAgo },
        },
        select: { completedAt: true },
      });
      const dateSet = new Set<string>();
      for (const s of sessions) {
        if (s.completedAt) {
          dateSet.add(s.completedAt.toISOString().split('T')[0]);
        }
      }
      activeDates = Array.from(dateSet);
    } else {
      // Fallback: use User.lastSessionDate to synthesise a single active date
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lastSessionDate: true },
      });
      if (user?.lastSessionDate) {
        const d = user.lastSessionDate;
        if (d >= sevenDaysAgo) {
          activeDates = [d.toISOString().split('T')[0]];
        }
      }
    }
  } catch {
    // On DB error, return empty list -- widget will show all-grey calendar
    activeDates = [];
  }

  return NextResponse.json({ activeDates });
}
