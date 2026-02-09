/**
 * FILE OBJECTIVE:
 * - API endpoint to check user's learning progress and return nudges for taking tests.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/nudges/test-prompt/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created test nudge/prompt API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';

const CLASS_NAME = 'TestNudgeAPI';

/**
 * Nudge types for different learning milestones
 */
export type NudgeType = 
  | 'lessons_completed' // Completed X lessons, time for a test
  | 'topic_mastery'     // Finished all lessons in a topic
  | 'weekly_review'     // Weekly review reminder
  | 'streak_check'      // Check understanding after streak
  | 'idle_return'       // Returning after period of inactivity

interface TestNudge {
  type: NudgeType;
  title: string;
  message: string;
  topicId?: string;
  topicName?: string;
  subjectId?: string;
  subjectName?: string;
  priority: 'high' | 'medium' | 'low';
  actionUrl: string;
  dismissable: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for nudge triggers
 */
const NUDGE_CONFIG = {
  // Number of lessons before suggesting a test
  LESSONS_BEFORE_TEST: 3,
  // Days of inactivity before showing return nudge
  IDLE_DAYS_THRESHOLD: 3,
  // Hours between nudge checks (don't spam)
  MIN_HOURS_BETWEEN_NUDGES: 4,
};

/**
 * GET /api/nudges/test-prompt
 * Returns personalized test nudges based on user's learning progress
 */
export async function GET(req: NextRequest) {
  const start = Date.now();
  const METHOD_NAME = 'GET';

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ nudges: [] });
    }

    const userId = session.user.id;
    const nudges: TestNudge[] = [];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get user's recent activity from models that actually exist in the schema
    const [lessonProgress, recentTestResults] = await Promise.all([
      prisma.lessonProgress.findMany({
        where: {
          userId,
          completed: true,
          updatedAt: { gte: sevenDaysAgo },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.testResult.findMany({
        where: {
          studentId: userId,
          createdAt: { gte: sevenDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // 1. Lessons completed without testing nudge
    const lessonsWithoutTest = lessonProgress.filter(() => recentTestResults.length === 0);
    if (lessonsWithoutTest.length >= NUDGE_CONFIG.LESSONS_BEFORE_TEST) {
      nudges.push({
        type: 'lessons_completed',
        title: 'Ready to check your progress?',
        message: `You've covered ${lessonsWithoutTest.length} lessons recently. A quick practice round can help it stick!`,
        priority: 'high',
        actionUrl: '/tests',
        dismissable: true,
        metadata: { lessonsCompleted: lessonsWithoutTest.length },
      });
    }

    // 2. Weekly review nudge — no test in last 5 days
    const lastTest = recentTestResults[0];
    if (!lastTest || Date.now() - new Date(lastTest.createdAt).getTime() > 5 * 24 * 60 * 60 * 1000) {
      if (lessonProgress.length > 0) {
        nudges.push({
          type: 'weekly_review',
          title: 'Quick refresh?',
          message: "A little revision goes a long way. Try a quick round to keep things fresh!",
          priority: 'medium',
          actionUrl: '/tests?type=review',
          dismissable: true,
        });
      }
    }

    // 3. Idle return nudge
    const lastActivity = lessonProgress[0]?.updatedAt;
    if (lastActivity) {
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(lastActivity).getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysSinceActivity >= NUDGE_CONFIG.IDLE_DAYS_THRESHOLD) {
        nudges.push({
          type: 'idle_return',
          title: 'Hey, welcome back!',
          message: 'Good to see you! How about a quick warm-up to get back in the groove?',
          priority: 'medium',
          actionUrl: '/tests?type=refresh',
          dismissable: true,
          metadata: { daysSinceActivity },
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    nudges.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Limit to top 3 nudges
    const topNudges = nudges.slice(0, 3);

    logger.info('Test nudges generated', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      userId,
      nudgeCount: topNudges.length,
      nudgeTypes: topNudges.map((n) => n.type),
    });

    const response = NextResponse.json({
      nudges: topNudges,
      nextCheckAt: new Date(Date.now() + NUDGE_CONFIG.MIN_HOURS_BETWEEN_NUDGES * 60 * 60 * 1000).toISOString(),
    });
    logger.logAPI(req, response, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
    return response;
  } catch (error) {
    logger.error('Failed to generate test nudges', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      error,
    });
    return NextResponse.json({ nudges: [], error: formatErrorForResponse(error) }, { status: 500 });
  }
}

/**
 * POST /api/nudges/test-prompt
 * Dismiss a nudge
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  const METHOD_NAME = 'POST';

  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { nudgeType, action } = body;

    if (!nudgeType || !action) {
      return NextResponse.json({ error: 'Missing nudgeType or action' }, { status: 400 });
    }

    // Log the nudge interaction for analytics
    logger.info('Nudge interaction', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      userId: session.user.id,
      nudgeType,
      action, // 'dismiss' | 'click' | 'snooze'
    });

    // Could store dismissal in a separate table or user metadata
    // For now, we just acknowledge
    const response = NextResponse.json({ ok: true });
    logger.logAPI(req, response, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
    return response;
  } catch (error) {
    logger.error('Failed to process nudge interaction', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      error,
    });
    return NextResponse.json({ error: formatErrorForResponse(error) }, { status: 500 });
  }
}
