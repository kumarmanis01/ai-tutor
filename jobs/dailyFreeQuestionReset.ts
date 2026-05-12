/**
 * FILE OBJECTIVE:
 * - Daily job to reset free question counts for all non-premium users at configured UTC time.
 *
 * LINKED UNIT TEST:
 * - tests/unit/jobs/dailyFreeQuestionReset.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created daily free question reset job
 * - 2026-05-07T00:00:00Z | copilot | add minute-level UTC scheduler config for exact reset timing
 * - 2026-05-07T00:00:00Z | copilot | set default scheduler to UTC+5 midnight equivalent
 * - 2026-05-11T00:00:00Z | copilot | also reset todayStudyMinutes for all users (daily study duration enforcement)
 * - 2026-05-11T13:10:00Z | copilot | clean up old PracticeMoreUsage records to reset daily "practice more" feature usage
 */

import { acquireJobLock, releaseJobLock } from '@/jobs/jobLock';
import logAuditEvent from '@/lib/audit/log';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { DAILY_FREE_QUESTION_LIMIT } from '@/lib/constants/freeTier';

const CLASS_NAME = 'DailyFreeQuestionReset';
const JOB_NAME = 'daily_free_question_reset';

/**
 * Result of running the daily reset job.
 */
export interface DailyResetResult {
  success: boolean;
  durationMs: number;
  usersUpdated?: number;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Reset the free question count for all non-premium users.
 * This should run at midnight UTC daily.
 * 
 * Premium users (those with active subscriptions) are excluded.
 */
export async function runDailyFreeQuestionReset(): Promise<DailyResetResult> {
  const started = Date.now();
  let lockAcquired = false;

  try {
    // Acquire non-overlapping job lock (5 minutes TTL for this simple job)
    const lock = await acquireJobLock(JOB_NAME, 5 * 60 * 1000);
    if ((lock as any).skipped) {
      // Record audit log for skipped run
      logAuditEvent(prisma, {
        targetEntity: 'System',
        targetId: 'daily_free_reset',
        action: null,
        details: { legacyAction: 'DAILY_FREE_RESET_RUN', status: 'SKIPPED', reason: (lock as any).reason ?? 'locked' },
      });
      
      const durationMs = Date.now() - started;
      return {
        success: false,
        durationMs,
        error: String((lock as any).reason ?? 'locked'),
        skipped: true,
        reason: (lock as any).reason,
      };
    }
    lockAcquired = true;

    logger.info('Starting daily free question reset job', {
      className: CLASS_NAME,
      methodName: 'runDailyFreeQuestionReset',
    });

    // Find all users who don't have an active premium subscription
    // and reset their free question count to the daily limit
    const result = await prisma.user.updateMany({
      where: {
        // Exclude users with an active (non-free) subscription.
        // Relation name is plural (`subscriptions`).
        subscriptions: {
          none: {
            active: true,
            plan: { not: 'free' },
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
        },
        // Only update users who have consumed some questions (optimization)
        todaysFreeQuestionsCount: {
          lt: DAILY_FREE_QUESTION_LIMIT,
        },
      },
      data: {
        todaysFreeQuestionsCount: DAILY_FREE_QUESTION_LIMIT,
      },
    });

    // Reset daily study minutes for ALL users (both free and premium).
    // This is separate from the question reset above because study-time limits
    // apply to every tier; only the cap differs (30 min free, 60 min premium).
    await prisma.user.updateMany({
      where: {
        todayStudyMinutes: { gt: 0 },
      },
      data: {
        todayStudyMinutes: 0,
      },
    });

    // Clean up old PracticeMoreUsage records (keep only today's record for fresh usage counting).
    // This ensures the "practice more" feature resets daily for all paid users.
    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    await prisma.practiceMoreUsage.deleteMany({
      where: {
        usageDate: { lt: todayDate },
      },
    });

    const durationMs = Date.now() - started;

    logger.info('Daily free question reset completed', {
      className: CLASS_NAME,
      methodName: 'runDailyFreeQuestionReset',
      usersUpdated: result.count,
      durationMs,
    });

    // Record audit log for successful run
    logAuditEvent(prisma, {
      targetEntity: 'System',
      targetId: 'daily_free_reset',
      action: null,
      details: { legacyAction: 'DAILY_FREE_RESET_RUN', status: 'SUCCESS', usersUpdated: result.count, durationMs },
    });

    return {
      success: true,
      durationMs,
      usersUpdated: result.count,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const errorMsg = String(error);

    logger.error('Daily free question reset failed', {
      className: CLASS_NAME,
      methodName: 'runDailyFreeQuestionReset',
      error: errorMsg,
      durationMs,
    });

    // Record audit log for failed run
    logAuditEvent(prisma, {
      targetEntity: 'System',
      targetId: 'daily_free_reset',
      action: null,
      details: { legacyAction: 'DAILY_FREE_RESET_RUN', status: 'FAILED', error: errorMsg, durationMs },
    });

    return {
      success: false,
      durationMs,
      error: errorMsg,
    };
  } finally {
    if (lockAcquired) {
      await releaseJobLock(JOB_NAME);
    }
  }
}

/**
 * Schedule the daily reset to run at midnight UTC.
 * Call this once during worker startup.
 */
export function scheduleDailyFreeQuestionReset(): void {
  // UTC+5 midnight is 19:00 UTC of the previous day.
  const resetHour = Number(process.env.FREE_QUESTION_RESET_HOUR || '19');
  const resetMinute = Number(process.env.FREE_QUESTION_RESET_MINUTE || '0'); // Default: :00 UTC
  
  const scheduleReset = async () => {
    try {
      logger.info('Running scheduled daily free question reset', {
        className: CLASS_NAME,
        methodName: 'scheduleDailyFreeQuestionReset',
      });
      const result = await runDailyFreeQuestionReset();
      logger.info('Scheduled daily reset result', {
        className: CLASS_NAME,
        methodName: 'scheduleDailyFreeQuestionReset',
        ...result,
      });
    } catch (error) {
      logger.error('Scheduled daily reset failed', {
        className: CLASS_NAME,
        methodName: 'scheduleDailyFreeQuestionReset',
        error: String(error),
      });
    }
  };

  // Compute milliseconds until next configured UTC run time (resetHour:resetMinute UTC)
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), resetHour, resetMinute, 0, 0)
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  const firstDelay = next.getTime() - now.getTime();

  logger.info('Daily free question reset scheduled', {
    className: CLASS_NAME,
    methodName: 'scheduleDailyFreeQuestionReset',
    resetHour,
    resetMinute,
    firstDelaySeconds: Math.round(firstDelay / 1000),
    nextRunAt: next.toISOString(),
  });

  // Set up the schedule: run once at the calculated time, then every 24h
  setTimeout(() => {
    void scheduleReset();
    setInterval(() => {
      void scheduleReset();
    }, 24 * 60 * 60 * 1000);
  }, firstDelay);
}
