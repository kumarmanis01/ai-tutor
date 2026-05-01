/**
 * FILE OBJECTIVE:
 * - Weekly job to reset free question counts (freeQuestionsCount) for all non-premium users every 7 days (Sunday 4 AM UTC).
 *
 * LINKED UNIT TEST:
 * - tests/unit/jobs/freeQuestionReset.spec.ts
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

const CLASS_NAME = 'FreeQuestionReset';
const JOB_NAME = 'free_question_reset';
const FREE_QUESTION_LIMIT = 5; // Example: 5 questions per week

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
 * This should run at 4 AM UTC every Sunday (weekly).
 *
 * Premium users (those with active subscriptions) are excluded.
 */
export async function runFreeQuestionReset(): Promise<DailyResetResult> {
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
        details: {
          legacyAction: 'DAILY_FREE_RESET_RUN',
          status: 'SKIPPED',
          reason: (lock as any).reason ?? 'locked',
        },
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

    logger.info('Starting weekly free question reset job', {
      className: CLASS_NAME,
      methodName: 'runFreeQuestionReset',
    });

    // Find all users who don't have an active premium subscription
    // and reset their freeQuestionsCount to the weekly limit
    const result = await prisma.user.updateMany({
      where: {
        subscriptions: {
          none: {
            active: true,
            plan: { not: 'free' },
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
        },
        freeQuestionsCount: {
          lt: FREE_QUESTION_LIMIT,
        },
      },
      data: {
        freeQuestionsCount: FREE_QUESTION_LIMIT,
      },
    });

    const durationMs = Date.now() - started;

    logger.info('Weekly free question reset completed', {
      className: CLASS_NAME,
      methodName: 'runFreeQuestionReset',
      usersUpdated: result.count,
      durationMs,
    });

    // Record audit log for successful run
    logAuditEvent(prisma, {
      targetEntity: 'System',
      targetId: 'weekly_free_reset',
      action: null,
      details: {
        legacyAction: 'WEEKLY_FREE_RESET_RUN',
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

    logger.error('Weekly free question reset failed', {
      className: CLASS_NAME,
      methodName: 'runFreeQuestionReset',
      error: errorMsg,
      durationMs,
    });

    // Record audit log for failed run
    logAuditEvent(prisma, {
      targetEntity: 'System',
      targetId: 'weekly_free_reset',
      action: null,
      details: {
        legacyAction: 'WEEKLY_FREE_RESET_RUN',
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
export function scheduleFreeQuestionReset(): void {
  // Schedule for Sunday 4 AM UTC
  const TARGET_DAY = 0; // Sunday (0=Sunday, 6=Saturday)
  const TARGET_HOUR = 4; // 4 AM UTC

  function msUntilNextWeeklyRun(targetDay: number, targetHour: number): number {
    const now = new Date();
    const next = new Date();
    next.setUTCHours(targetHour, 0, 0, 0);
    const currentDay = now.getUTCDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
      daysUntil += 7;
    }
    next.setUTCDate(now.getUTCDate() + daysUntil);
    return next.getTime() - now.getTime();
  }

  const scheduleReset = async () => {
    try {
      logger.info('Running scheduled weekly free question reset', {
        className: CLASS_NAME,
        methodName: 'scheduleFreeQuestionReset',
      });
      const result = await runFreeQuestionReset();
      logger.info('Scheduled weekly reset result', {
        className: CLASS_NAME,
        methodName: 'scheduleFreeQuestionReset',
        ...result,
      });
    } catch (error) {
      logger.error('Scheduled weekly reset failed', {
        className: CLASS_NAME,
        methodName: 'scheduleFreeQuestionReset',
        error: String(error),
      });
    }
  };

  const firstDelay = msUntilNextWeeklyRun(TARGET_DAY, TARGET_HOUR);

  logger.info('Weekly free question reset scheduled', {
    className: CLASS_NAME,
    methodName: 'scheduleFreeQuestionReset',
    targetDay: TARGET_DAY,
    targetHour: TARGET_HOUR,
    firstDelaySeconds: Math.round(firstDelay / 1000),
  });

  setTimeout(() => {
    void scheduleReset();
    setInterval(
      () => {
        void scheduleReset();
      },
      7 * 24 * 60 * 60 * 1000 // 7 days
    );
  }, firstDelay);
}
