/**
 * FILE OBJECTIVE:
 * - Daily job to reset free question counts for all non-premium users at midnight UTC.
 *
 * LINKED UNIT TEST:
 * - tests/unit/jobs/dailyFreeQuestionReset.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created daily free question reset job
 */

import { acquireJobLock, releaseJobLock } from '@/jobs/jobLock';
import logAuditEvent from '@/lib/audit/log';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const CLASS_NAME = 'DailyFreeQuestionReset';
const JOB_NAME = 'daily_free_question_reset';
const DAILY_FREE_LIMIT = 3;

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
        action: 'DAILY_FREE_RESET_RUN',
        metadata: { status: 'SKIPPED', reason: (lock as any).reason ?? 'locked' },
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
        // Exclude users with active subscriptions
        // A user is premium if they have a Subscription with status 'active'
        OR: [
          {
            subscription: null,
          },
          {
            subscription: {
              status: {
                not: 'active',
              },
            },
          },
        ],
        // Only update users who have consumed some questions (optimization)
        todaysFreeQuestionsCount: {
          lt: DAILY_FREE_LIMIT,
        },
      },
      data: {
        todaysFreeQuestionsCount: DAILY_FREE_LIMIT,
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
      action: 'DAILY_FREE_RESET_RUN',
      metadata: {
        status: 'SUCCESS',
        usersUpdated: result.count,
        durationMs,
      },
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
      action: 'DAILY_FREE_RESET_RUN',
      metadata: {
        status: 'FAILED',
        error: errorMsg,
        durationMs,
      },
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
  const resetHour = Number(process.env.FREE_QUESTION_RESET_HOUR || '0'); // Default: midnight UTC
  
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

  // Compute milliseconds until next midnight (resetHour:00 UTC)
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), resetHour, 0, 0, 0)
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  const firstDelay = next.getTime() - now.getTime();

  logger.info('Daily free question reset scheduled', {
    className: CLASS_NAME,
    methodName: 'scheduleDailyFreeQuestionReset',
    resetHour,
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
