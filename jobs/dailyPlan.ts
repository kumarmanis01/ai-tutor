/**
 * FILE OBJECTIVE:
 * - BullMQ queue registration and batch processor for the nightly daily-plan
 *   pre-computation job. processDailyPlans() called by scheduler at 17:30 UTC.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial creation for S2-4 Daily Study Plan
 */

import { Queue } from 'bullmq';
import { getSharedConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { computeDailyPlan, cacheDailyPlan } from '@/lib/studyPlan/dailyPlan';

export const DAILY_PLAN_QUEUE_NAME = 'daily-plan-queue';

// Nightly at 23:00 IST = 17:30 UTC
const DAILY_PLAN_CRON = '30 17 * * *';

const BATCH_SIZE = 100;
const CONCURRENCY = 5;

let dailyPlanQueue: Queue | null = null;

export function getDailyPlanQueue(): Queue {
  if (!dailyPlanQueue) {
    dailyPlanQueue = new Queue(DAILY_PLAN_QUEUE_NAME, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 10,
        removeOnFail: 20,
      },
    });
  }
  return dailyPlanQueue;
}

/**
 * Register the daily-plan repeatable job. Idempotent -- skips if already registered.
 */
export async function registerDailyPlanJob(): Promise<void> {
  try {
    const queue = getDailyPlanQueue();
    const repeatable = await queue.getRepeatableJobs();
    const already = repeatable.some(
      (j) => j.pattern === DAILY_PLAN_CRON && j.name === 'daily-plan',
    );
    if (already) {
      logger.info('[dailyPlan] repeatable job already registered', { cron: DAILY_PLAN_CRON });
      return;
    }
    await queue.add('daily-plan', {}, { repeat: { pattern: DAILY_PLAN_CRON } });
    logger.info('[dailyPlan] registered repeatable job', { cron: DAILY_PLAN_CRON });
  } catch (err) {
    logger.error('[dailyPlan] failed to register job', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Pre-compute and cache daily study plans for all active students.
 * Paginates in batches of 100, processes each chunk of 5 concurrently.
 * Per-user failures are isolated -- one error never aborts the batch.
 */
export async function processDailyPlans(): Promise<{ processed: number; failed: number }> {
  logger.info('dailyPlan.process.start');
  let processed = 0;
  let failed = 0;
  let skip = 0;

  while (true) {
    let userIds: string[];
    try {
      const rows = await prisma.topicProgress.findMany({
        distinct: ['userId'],
        orderBy: { userId: 'asc' },
        skip,
        take: BATCH_SIZE,
        select: { userId: true },
      });
      userIds = rows.map((r: { userId: string }) => r.userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('dailyPlan.process.batch.fetchFailed', { skip, error: message });
      break;
    }

    if (userIds.length === 0) break;

    // Process CONCURRENCY users at a time within this batch
    for (let i = 0; i < userIds.length; i += CONCURRENCY) {
      const chunk = userIds.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (userId) => {
          const plan = await computeDailyPlan(userId);
          await cacheDailyPlan(userId, plan);
        }),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          processed++;
        } else {
          failed++;
          logger.error('dailyPlan.process.user.failed', {
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
      }
    }

    skip += userIds.length;
    if (userIds.length < BATCH_SIZE) break;
  }

  logger.info('dailyPlan.process.complete', { processed, failed });
  return { processed, failed };
}
