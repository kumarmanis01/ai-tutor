/**
 * Daily Learning Habit: daily goal, streak, weekly activity, learning points.
 * Idempotent recordSessionCompletion keyed by sessionId.
 */

import { prisma } from '@/lib/prisma';
import {
  getLocalDateString,
  getTodayLocalDateString,
  startOfLocalDayUtc,
  endOfLocalDayUtc,
} from './timezone';
import {
  getUniqueStudyDays,
  getWeeklyActivity as queryWeeklyActivity,
  computeStreakFromStudyDays,
  countCompletionsInRange,
} from './engagementQueries';
import { logger } from '@/lib/logger';

export const LEARNING_POINTS_PER_SESSION = 25;
const TZ_DEFAULT = 'UTC';

export type DailyGoalState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface TodayCompletion {
  state: DailyGoalState;
  completedAt?: string; // ISO if completed
}

export interface WeeklyDay {
  date: string;
  completed: boolean;
}

/**
 * Whether the student has completed at least one session "today" in their timezone.
 */
export async function getTodayCompletion(studentId: string): Promise<TodayCompletion> {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { timezone: true },
  });
  const tz = user?.timezone ?? TZ_DEFAULT;
  const today = getTodayLocalDateString(tz);
  const from = startOfLocalDayUtc(today, tz);
  const toExclusive = endOfLocalDayUtc(today, tz);
  const toInclusive = new Date(toExclusive.getTime() - 1);

  const count = await countCompletionsInRange(studentId, from, toInclusive);
  if (count === 0) {
    return { state: 'NOT_STARTED' };
  }

  const latest = await prisma.structuredSession.findFirst({
    where: {
      studentId,
      state: 'COMPLETE',
      completedAt: { gte: from, lte: toInclusive },
    },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true },
  });
  return {
    state: 'COMPLETED',
    completedAt: latest?.completedAt?.toISOString(),
  };
}

/**
 * Current streak (consecutive days with ≥1 completion). Uses cache if present and fresh; else computes from sessions.
 */
export async function getCurrentStreak(
  studentId: string
): Promise<{ current: number; longest: number }> {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { timezone: true },
  });
  const tz = user?.timezone ?? TZ_DEFAULT;
  const today = getTodayLocalDateString(tz);

  const studyDays = await getUniqueStudyDays(studentId, {
    timezone: tz,
    limit: 365,
  });
  const { current, longest } = computeStreakFromStudyDays(studyDays, today);

  const stats = await prisma.studentEngagementStats.findUnique({
    where: { studentId },
    select: { longestStreak: true },
  });
  const longestEver = stats?.longestStreak ?? 0;
  return {
    current,
    longest: Math.max(longest, longestEver),
  };
}

/**
 * Last 7 days (student local), each with completed true/false.
 */
export async function getWeeklyActivity(studentId: string): Promise<WeeklyDay[]> {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { timezone: true },
  });
  const tz = user?.timezone ?? TZ_DEFAULT;
  return queryWeeklyActivity(studentId, tz);
}

/**
 * Record a session completion: +25 points, update streak cache. Idempotent per sessionId.
 * Call from SESSION_COMPLETED handler with payload.studentId and payload.sessionId.
 */
export async function recordSessionCompletion(studentId: string, sessionId: string): Promise<void> {
  const existing = await prisma.engagementProcessedSession.findUnique({
    where: { sessionId },
  });
  if (existing) {
    return;
  }

  const session = await prisma.structuredSession.findFirst({
    where: { id: sessionId, studentId, state: 'COMPLETE' },
    select: { completedAt: true },
  });
  if (!session?.completedAt) {
    logger.warn('[ENGAGEMENT] recordSessionCompletion: session not found or not complete', {
      sessionId,
      studentId,
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { timezone: true },
  });
  const tz = user?.timezone ?? TZ_DEFAULT;
  const completionDateStr = getLocalDateString(session.completedAt, tz);

  const studyDays = await getUniqueStudyDays(studentId, { timezone: tz, limit: 400 });
  const today = getTodayLocalDateString(tz);
  const { current, longest } = computeStreakFromStudyDays(studyDays, today);
  const lastActiveDate = startOfLocalDayUtc(completionDateStr, tz);
  const existingStats = await prisma.studentEngagementStats.findUnique({
    where: { studentId },
    select: { longestStreak: true },
  });
  const newLongest = Math.max(longest, existingStats?.longestStreak ?? 0);

  await prisma.$transaction(async (tx) => {
    await tx.engagementProcessedSession.create({
      data: { sessionId, studentId },
    });
    await tx.user.update({
      where: { id: studentId },
      data: { points: { increment: LEARNING_POINTS_PER_SESSION } },
    });
    await tx.studentEngagementStats.upsert({
      where: { studentId },
      create: {
        studentId,
        totalSessionsCompleted: 1,
        learningPoints: LEARNING_POINTS_PER_SESSION,
        lastActiveDate,
        currentStreak: current,
        longestStreak: newLongest,
      },
      update: {
        totalSessionsCompleted: { increment: 1 },
        learningPoints: { increment: LEARNING_POINTS_PER_SESSION },
        lastActiveDate,
        currentStreak: current,
        longestStreak: newLongest,
      },
    });
  });
}
