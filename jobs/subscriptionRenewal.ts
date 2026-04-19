/**
 * FILE OBJECTIVE:
 * - Register a repeatable BullMQ job to drive subscription renewal retries and
 *   EMI installment processing.
 *
 * LINKED UNIT TEST:
 * - tests/unit/workers/subscriptionRenewalWorker.test.ts
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created subscription renewal job registration
 */

import { Queue } from 'bullmq'
import { getSharedConnection } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const SUBSCRIPTION_RENEWAL_QUEUE_NAME = 'subscription-renewal'

// Run hourly to pick up due renewals and EMI installments
const RENEWAL_CRON = '0 * * * *'

let renewalQueue: Queue | null = null

export function getSubscriptionRenewalQueue(): Queue {
  if (!renewalQueue) {
    renewalQueue = new Queue(SUBSCRIPTION_RENEWAL_QUEUE_NAME, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 20,
        removeOnFail: 50,
      },
    })
  }
  return renewalQueue
}

export async function registerSubscriptionRenewalJob(): Promise<void> {
  try {
    const queue = getSubscriptionRenewalQueue()
    const repeatable = await queue.getRepeatableJobs()
    const already = repeatable.some((j) => j.pattern === RENEWAL_CRON && j.name === 'subscription-renewal')
    if (already) {
      logger.info('[subscriptionRenewal] repeatable job already registered', { cron: RENEWAL_CRON })
      return
    }
    await queue.add('subscription-renewal', {}, { repeat: { pattern: RENEWAL_CRON } })
    logger.info('[subscriptionRenewal] registered repeatable job', { cron: RENEWAL_CRON })
  } catch (err) {
    logger.error('[subscriptionRenewal] failed to register job', { error: err instanceof Error ? err.message : String(err) })
  }
}

export default getSubscriptionRenewalQueue
