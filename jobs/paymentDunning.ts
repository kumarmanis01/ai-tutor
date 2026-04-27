/**
 * Payment dunning repeatable job registration
 */

import { Queue } from 'bullmq'
import { getSharedConnection } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const PAYMENT_DUNNING_QUEUE_NAME = 'payment-dunning'

// Run daily at 02:00 UTC
const DAILY_CRON = '0 2 * * *'

let dunningQueue: Queue | null = null

export function getPaymentDunningQueue(): Queue {
  if (!dunningQueue) {
    dunningQueue = new Queue(PAYMENT_DUNNING_QUEUE_NAME, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 10,
        removeOnFail: 20,
      },
    })
  }
  return dunningQueue
}

export async function registerDailyDunningJob(): Promise<void> {
  try {
    const queue = getPaymentDunningQueue()
    const repeatable = await queue.getRepeatableJobs()
    const already = repeatable.some((j) => j.pattern === DAILY_CRON && j.name === 'payment-dunning')
    if (already) {
      logger.info('[paymentDunning] repeatable job already registered', { cron: DAILY_CRON })
      return
    }
    await queue.add('payment-dunning', {}, { repeat: { pattern: DAILY_CRON } })
    logger.info('[paymentDunning] registered repeatable job', { cron: DAILY_CRON })
  } catch (err) {
    logger.error('[paymentDunning] failed to register job', { error: String(err) })
  }
}
