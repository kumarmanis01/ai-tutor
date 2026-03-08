/**
 * Prisma queries for engagement: unique study days, streak, weekly activity.
 * All dates interpreted in student timezone. Only completed sessions (state COMPLETE, completedAt set).
 */

import { prisma } from '@/lib/prisma';
import { getLocalDateString, startOfLocalDayUtc } from './timezone';

const TZ_DEFAULT = 'UTC';

/**
 * Returns distinct calendar dates (YYYY-MM-DD in student TZ) on which the student
 * completed at least one session, within the optional date range (UTC).
 * Ordered by date desc (most recent first).
 */
export async function getUniqueStudyDays(
  studentId: string,
  options: {
    timezone?: string | null;
    sinceUtc?: Date;
    untilUtc?: Date;
    limit?: number;
  } = {},
): Promise<string[]> {
  const tz = options.timezone ?? TZ_DEFAULT;
  const completedAtCond: { not: null; gte?: Date; lte?: Date } = { not: null };
  if (options.sinceUtc != null) completedAtCond.gte = options.sinceUtc;
  if (options.untilUtc != null) completedAtCond.lte = options.untilUtc;
  const where = {
    studentId,
    state: 'COMPLETE' as const,
    completedAt: completedAtCond,
  };

  const sessions = await prisma.structuredSession.findMany({
    where,
    select: { completedAt: true },
    orderBy: { completedAt: 'desc' },
    take: options.limit ?? 500,
  });

  const dateSet = new Set<string>();
  for (const s of sessions) {
    if (s.completedAt) dateSet.add(getLocalDateString(s.completedAt, tz));
  }
  return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
}

/**
 * Current streak = consecutive calendar days with ≥1 completion, ending on or before "today".
 * If today has a completion, streak includes today; else streak ends the most recent completed day.
 * Returns 0 if no completions or no streak.
 */
export function computeStreakFromStudyDays(
  studyDays: string[],
  todayLocal: string,
): { current: number; longest: number } {
  if (studyDays.length === 0) return { current: 0, longest: 0 };
  const sorted = [...studyDays].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevDate = new Date(prev);
    const nextExpected = new Date(prevDate);
    nextExpected.setUTCDate(nextExpected.getUTCDate() + 1);
    const nextStr = nextExpected.toISOString().slice(0, 10);
    if (curr === nextStr) {
      run += 1;
    } else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run);

  // Current streak: from today (or latest day) backwards
  const latestDay = sorted[sorted.length - 1];
  let current = 0;
  let check = todayLocal;
  const daySet = new Set(sorted);
  while (daySet.has(check)) {
    current += 1;
    const d = new Date(check + 'T12:00:00.000Z');
    d.setUTCDate(d.getUTCDate() - 1);
    check = d.toISOString().slice(0, 10);
  }
  // If we didn't start from today, streak might be "consecutive up to yesterday" - requirement says
  // "consecutive days with at least one session". So current = consecutive including today if today done, else consecutive ending at last completed day.
  if (current === 0 && latestDay) {
    check = latestDay;
    while (daySet.has(check)) {
      current += 1;
      const d = new Date(check + 'T12:00:00.000Z');
      d.setUTCDate(d.getUTCDate() - 1);
      check = d.toISOString().slice(0, 10);
    }
  }
  return { current, longest };
}

/**
 * Weekly activity: last 7 calendar days in student TZ, each day marked as having a completion or not.
 * Returns array of { date: YYYY-MM-DD, completed: boolean }, most recent first.
 */
export async function getWeeklyActivity(
  studentId: string,
  timezone: string | null | undefined,
): Promise<{ date: string; completed: boolean }[]> {
  const tz = timezone ?? TZ_DEFAULT;
  const today = getLocalDateString(new Date(), tz);
  const results: { date: string; completed: boolean }[] = [];
  const start = startOfLocalDayUtc(today, tz);
  const sevenDaysAgo = new Date(start.getTime() - 6 * 24 * 60 * 60 * 1000);
  const sinceUtc = startOfLocalDayUtc(
    getLocalDateString(sevenDaysAgo, tz),
    tz,
  );

  const studyDays = await getUniqueStudyDays(studentId, {
    timezone: tz,
    sinceUtc,
    untilUtc: new Date(),
    limit: 10,
  });
  const studySet = new Set(studyDays);

  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = getLocalDateString(d, tz);
    results.push({ date: dateStr, completed: studySet.has(dateStr) });
  }
  return results;
}

/**
 * Count completed sessions whose completedAt falls within the given UTC range (inclusive).
 */
export async function countCompletionsInRange(
  studentId: string,
  fromUtc: Date,
  toUtc: Date,
): Promise<number> {
  const n = await prisma.structuredSession.count({
    where: {
      studentId,
      state: 'COMPLETE',
      completedAt: { gte: fromUtc, lte: toUtc },
    },
  });
  return n;
}
