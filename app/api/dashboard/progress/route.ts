export const dynamic = 'force-dynamic'

/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch user learning progress metrics.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/dashboard/progress/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22 | copilot | created progress endpoint with test/session metrics
 * - 2026-02-07 | copilot | added force-dynamic to prevent static render error
 */
import { NextResponse } from 'next/server';
import { LOW_ACCURACY_THRESHOLD } from '@/lib/constants/mastery';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await getServerSessionForHandlers();
    if (!session?.user?.id) {
      return NextResponse.json({
        testsCompleted: 0,
        averageScore: 0,
        totalSessions: 0,
        subjectsStudied: 0,
        weeklyProgress: 0,
        weeklyGoalMinutes: 120,
        weeklyTestsGoal: 5,
      });
    }

    const userId = session.user.id;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Fetch all metrics in parallel. Avoid loading every TestResult row for
    // prolific students; use aggregate for count + average and a separate
    // distinct query for the subject set.
    const [
      testResultsAggregate,
      totalSessions,
      weeklySessionsCount,
      subjectsFromTests,
      subjectsFromSessions,
      topicsCompleted,
      topicsStarted,
    ] = await Promise.all([
      // Test count + average score (server-side aggregate, no row load)
      prisma.testResult.aggregate({
        where: { studentId: userId },
        _count: { _all: true },
        _avg: { score: true },
      }),
      // Total learning sessions
      prisma.learningSession.count({
        where: { studentId: userId },
      }),
      // Sessions this week (for weekly progress)
      prisma.learningSession.count({
        where: {
          studentId: userId,
          startedAt: { gte: oneWeekAgo },
        },
      }),
      // Unique subjects from test results
      prisma.testResult.findMany({
        where: { studentId: userId },
        select: { testId: true },
        distinct: ['testId'],
        take: 1000,
      }),
      // Unique subjects from learning sessions
      prisma.learningSession.findMany({
        where: { studentId: userId },
        select: { activityType: true },
        distinct: ['activityType'],
        take: 100,
      }),
      // Topics considered complete -- aligned with engine P4 threshold (accuracy >= LOW_ACCURACY_THRESHOLD)
      prisma.studentTopicMastery.count({
        where: {
          studentId: userId,
          accuracy: { gte: LOW_ACCURACY_THRESHOLD },
        },
      }),
      // Topics started (any mastery record)
      prisma.studentTopicMastery.count({
        where: { studentId: userId },
      }),
    ]);

    const testsCompleted = testResultsAggregate._count._all;
    const averageScore = testResultsAggregate._avg.score != null
      ? Math.round(testResultsAggregate._avg.score)
      : 0;
    
    // Count unique subjects
    const subjectsStudied = new Set([
      ...subjectsFromTests.map((t: { testId: string }) => t.testId),
      ...subjectsFromSessions.map((s: { activityType: string }) => s.activityType),
    ]).size;
    
    // Weekly progress (sessions completed this week vs goal of 10)
    const weeklyGoal = 10;
    const weeklyProgress = Math.min(Math.round((weeklySessionsCount / weeklyGoal) * 100), 100);

    return NextResponse.json({
      testsCompleted,
      averageScore,
      totalSessions,
      subjectsStudied,
      weeklyProgress,
      weeklyGoalMinutes: 120,
      weeklyTestsGoal: 5,
      topicsCompleted,
      topicsStarted,
    });
  } catch (error) {
    logger.error('Error fetching progress:', { error: String(error) });
    return NextResponse.json({
      testsCompleted: 0,
      averageScore: 0,
      totalSessions: 0,
      subjectsStudied: 0,
      weeklyProgress: 0,
      weeklyGoalMinutes: 120,
      weeklyTestsGoal: 5,
    });
  }
}
