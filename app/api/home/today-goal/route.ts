/**
 * FILE OBJECTIVE:
 * - Returns today's learning goal progress for the authenticated student.
 * - No AI. No cron jobs. Pure runtime aggregation.
 *
 * Goal source (priority order):
 *   1. ParentChildControl.dailyTimeLimitMin (parent-set limit)
 *   2. Default: 30 minutes
 *
 * Time spent source:
 *   - Sum of LearningSession.actualTimeSpent for sessions started today (UTC).
 *   - actualTimeSpent is stored in minutes.
 *
 * Streak source:
 *   - StudentStreak where kind = 'daily'.
 *
 * Response shape:
 *   { targetMinutes: number, completedMinutes: number, streakDays: number }
 *
 * EDIT LOG:
 * - 2026-02-22 | claude | created — replaces zero-placeholder with real aggregation
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

const DEFAULT_DAILY_GOAL_MINUTES = 30;

/** UTC midnight of today */
function utcMidnightToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json(
      { targetMinutes: DEFAULT_DAILY_GOAL_MINUTES, completedMinutes: 0, streakDays: 0 },
      { status: 401 }
    );
  }

  const todayStart = utcMidnightToday();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  // Run all three queries in parallel
  const [parentControl, todaySessions, streak] = await Promise.all([
    // 1. Parent-defined daily time limit
    prisma.parentChildControl.findFirst({
      where: { studentId: userId },
      select: { dailyTimeLimitMin: true },
      orderBy: { createdAt: 'desc' },
    }),

    // 2. Today's sessions — sum actualTimeSpent (stored in minutes)
    prisma.learningSession.findMany({
      where: {
        studentId: userId,
        startedAt: { gte: todayStart, lt: tomorrowStart },
      },
      select: { actualTimeSpent: true },
    }),

    // 3. Daily streak
    prisma.studentStreak.findFirst({
      where: { studentId: userId, kind: 'daily' },
      select: { current: true },
    }),
  ]);

  const targetMinutes =
    parentControl?.dailyTimeLimitMin && parentControl.dailyTimeLimitMin > 0
      ? parentControl.dailyTimeLimitMin
      : DEFAULT_DAILY_GOAL_MINUTES;

  const completedMinutes = todaySessions.reduce(
    (sum, s) => sum + (s.actualTimeSpent ?? 0),
    0
  );

  const streakDays = streak?.current ?? 0;

  return NextResponse.json({ targetMinutes, completedMinutes, streakDays });
}
