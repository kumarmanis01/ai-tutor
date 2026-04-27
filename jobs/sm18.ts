import { Queue } from 'bullmq'
import { getSharedConnection } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const SM18_SCHEDULER_QUEUE_NAME = 'sm18-scheduler'

const NIGHTLY_CRON = '0 2 * * *' // 2 AM daily

let sm18Queue: Queue | null = null

export function getSM18Queue(): Queue {
  if (!sm18Queue) {
    sm18Queue = new Queue(SM18_SCHEDULER_QUEUE_NAME, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    })
  }
  return sm18Queue
}

/**
 * Register the nightly SM-18 job (2 AM daily). Idempotent: skips if already registered.
 */
export async function registerNightlySM18Job(): Promise<void> {
  try {
    const queue = getSM18Queue()
    const repeatable = await queue.getRepeatableJobs()
    const already = repeatable.some((j) => j.pattern === NIGHTLY_CRON && j.name === 'nightly-sm18')
    if (already) {
      logger.info('[sm18] nightly repeatable job already registered', { cron: NIGHTLY_CRON })
      return
    }
    await queue.add(
      'nightly-sm18',
      {},
      {
        repeat: { pattern: NIGHTLY_CRON },
      },
    )
    logger.info('[sm18] registered nightly repeatable job', { cron: NIGHTLY_CRON })
  } catch (err) {
    logger.error('[sm18] failed to register nightly job', {
      error: String((err as any)?.message ?? err),
    })
  }
}
