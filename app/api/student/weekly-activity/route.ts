/**
 * GET /api/student/weekly-activity
 *
 * Returns a 7-entry array (Mon–Sun) for the current ISO week, each entry
 * indicating whether the student had at least one structured session that day.
 * Also returns the total session count for the week and the current streak.
 *
 * Response shape:
 *   {
 *     days: { date: string; dayLabel: string; hasSession: boolean }[],
 *     sessionCountThisWeek: number,
 *     currentStreak: number
 *   }
 *
 * Week boundary: Monday 00:00:00 UTC → Sunday 23:59:59 UTC.
 * This matches the boundary used by weeklyParentSummary.ts.
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created for WeeklyStudyStrip component
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getISOWeekBoundaries(): { monday: Date; sunday: Date } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  // Distance back to Monday: Sun=6, Mon=0, Tue=1, …
  const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - distanceToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return { monday, sunday };
}

export async function GET() {
  const authSession = await getServerSessionForHandlers();
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = authSession.user.id;

  const { monday, sunday } = getISOWeekBoundaries();

  // Single query: fetch all sessions in the current week.
  const sessions = await prisma.structuredSession.findMany({
    where: {
      studentId: userId,
      startedAt: { gte: monday, lte: sunday },
    },
    select: { startedAt: true },
  });

  // Build the 7-day array (Mon=index 0 … Sun=index 6).
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + i);
    return {
      date: date.toISOString().split('T')[0],
      dayLabel: DAY_LABELS[i],
      hasSession: false,
    };
  });

  for (const s of sessions) {
    const dow = new Date(s.startedAt).getUTCDay(); // 0=Sun
    const idx = dow === 0 ? 6 : dow - 1;           // convert to Mon=0
    if (idx >= 0 && idx < 7) days[idx].hasSession = true;
  }

  // Fetch current streak for display alongside the strip.
  const streak = await prisma.studentStreak.findFirst({
    where: { studentId: userId, kind: 'daily' },
    select: { current: true },
  });

  return NextResponse.json({
    days,
    sessionCountThisWeek: sessions.length,
    currentStreak: streak?.current ?? 0,
  });
}
