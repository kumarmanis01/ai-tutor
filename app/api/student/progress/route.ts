/**
 * FILE OBJECTIVE:
 * - GET /api/student/progress
 * - Returns weekly progress metrics for the authenticated student:
 *     topicsCompleted, sessionsCompleted, subjectsExplored,
 *     weeklyGoalMinutes, minutesStudied
 * - minutesStudied is estimated: sessions this week × AVG_SESSION_MINUTES.
 * - weeklyGoalMinutes is derived from the student's learning profile
 *   (dailyTargetMin × studyDaysPerWeek) with sensible defaults.
 *
 * EDIT LOG:
 * - 2026-03-06 | Manish Kumar | created for WeeklyProgress dashboard card
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** Rough average minutes per session used to estimate minutesStudied. */
const AVG_SESSION_MINUTES = 20;

const DEFAULT_DAILY_TARGET_MIN = 30;
const DEFAULT_STUDY_DAYS_PER_WEEK = 5;

function weekStart(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export async function GET(req: Request) {
  const start = Date.now();
  let res: Response;

  const authSession = await getServerSessionForHandlers();
  const user = authSession?.user;

  if (!user?.id) {
    res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'StudentProgressAPI', methodName: 'GET' }, start);
    return res;
  }

  const weekBegin = weekStart();

  const [profile, topicsCompleted, sessionsThisWeek] = await Promise.all([
    // Learning profile for weekly goal config
    prisma.studentLearningProfile.findUnique({
      where: { studentId: user.id },
      select: { dailyTargetMin: true, studyDaysPerWeek: true },
    }),

    // Topics where mastery >= 0.8 updated this week
    prisma.studentTopicProgress.count({
      where: {
        studentId: user.id,
        mastery: { gte: 0.8 },
        lastStudiedAt: { gte: weekBegin },
      },
    }),

    // Sessions completed (or started) this week
    prisma.structuredSession.findMany({
      where: {
        studentId: user.id,
        startedAt: { gte: weekBegin },
      },
      select: {
        id: true,
        completedAt: true,
        topic: {
          select: {
            chapter: { select: { subject: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  // Distinct subjects explored this week
  const subjectSet = new Set(
    sessionsThisWeek.map((s: any) => s.topic.chapter.subject.name)
  );

  const sessionsCompleted = sessionsThisWeek.filter((s: any) => s.completedAt !== null).length;
  const subjectsExplored = subjectSet.size;
  const minutesStudied = sessionsThisWeek.length * AVG_SESSION_MINUTES;

  const dailyTarget = profile?.dailyTargetMin ?? DEFAULT_DAILY_TARGET_MIN;
  const studyDays = profile?.studyDaysPerWeek ?? DEFAULT_STUDY_DAYS_PER_WEEK;
  const weeklyGoalMinutes = dailyTarget * studyDays;

  res = NextResponse.json({
    topicsCompleted,
    sessionsCompleted,
    subjectsExplored,
    weeklyGoalMinutes,
    minutesStudied,
  });

  logger.logAPI(req, res, { className: 'StudentProgressAPI', methodName: 'GET' }, start);
  return res;
}
