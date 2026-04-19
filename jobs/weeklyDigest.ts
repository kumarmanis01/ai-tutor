/**
 * Weekly parent digest — BullMQ repeatable job registration (T39)
 *
 * Fires every Sunday at 18:00 IST (12:30 UTC).
 * Follows the same pattern as jobs/sm18.ts.
 */

import { Queue } from 'bullmq'
import { getSharedConnection } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const WEEKLY_DIGEST_QUEUE_NAME = 'weekly-parent-digest'

// Sunday 18:00 IST = Sunday 12:30 UTC
const WEEKLY_CRON = '30 12 * * 0'

let digestQueue: Queue | null = null

export function getWeeklyDigestQueue(): Queue {
  if (!digestQueue) {
    digestQueue = new Queue(WEEKLY_DIGEST_QUEUE_NAME, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 10,
        removeOnFail: 20,
      },
    })
  }
  return digestQueue
}

/**
 * Register the weekly digest repeatable job. Idempotent — skips if already registered.
 */
export async function registerWeeklyDigestJob(): Promise<void> {
  try {
    const queue = getWeeklyDigestQueue()
    const repeatable = await queue.getRepeatableJobs()
    const already = repeatable.some(
      (j) => j.pattern === WEEKLY_CRON && j.name === 'weekly-parent-digest',
    )
    if (already) {
      logger.info('[weeklyDigest] repeatable job already registered', { cron: WEEKLY_CRON })
      return
    }
    await queue.add('weekly-parent-digest', {}, { repeat: { pattern: WEEKLY_CRON } })
    logger.info('[weeklyDigest] registered repeatable job', { cron: WEEKLY_CRON })
  } catch (err) {
    logger.error('[weeklyDigest] failed to register job', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
