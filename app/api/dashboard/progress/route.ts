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

    // Fetch all metrics in parallel
    const [
      testResults,
      totalSessions,
      weeklySessionsCount,
      subjectsFromTests,
      subjectsFromSessions,
      topicsCompleted,
      topicsStarted,
    ] = await Promise.all([
      // Test results for score calculation
      prisma.testResult.findMany({
        where: { studentId: userId },
        select: { score: true, finishedAt: true, createdAt: true },
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
      }),
      // Unique subjects from learning sessions
      prisma.learningSession.findMany({
        where: { studentId: userId },
        select: { activityType: true },
        distinct: ['activityType'],
      }),
      // Topics marked complete (advanced or expert)
      prisma.studentTopicMastery.count({
        where: {
          studentId: userId,
          masteryLevel: { in: ['advanced', 'expert'] },
        },
      }),
      // Topics started (any mastery record)
      prisma.studentTopicMastery.count({
        where: { studentId: userId },
      }),
    ]);

    // Calculate metrics
    const testsCompleted = testResults.length;
    
    // Calculate average score (only from completed tests with scores)
    const scoresWithValues = testResults
      .filter((r: { score: number | null }) => typeof r.score === 'number')
      .map((r: { score: number | null }) => r.score as number);
    const averageScore = scoresWithValues.length > 0
      ? Math.round(scoresWithValues.reduce((a: number, b: number) => a + b, 0) / scoresWithValues.length)
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
    logger.error('Error fetching progress:', error);
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
