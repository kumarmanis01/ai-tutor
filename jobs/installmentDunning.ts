/**
 * FILE OBJECTIVE:
 * - Expose a BullMQ queue for installment-level dunning and register a daily repeatable job.
 *
 * LINKED UNIT TEST:
 * - tests/unit/jobs/installmentDunning.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-10T00:00:00Z | copilot | created
 */

import { Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const INSTALLMENT_DUNNING_QUEUE_NAME = 'installment-dunning'

// Run daily at 03:00 UTC
const DAILY_CRON = '0 3 * * *'

let installmentQueue: Queue | null = null

export function getInstallmentDunningQueue(): Queue {
  if (!installmentQueue) {
    installmentQueue = new Queue(INSTALLMENT_DUNNING_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 10,
        removeOnFail: 20,
      },
    })
  }
  return installmentQueue
}

export async function registerDailyInstallmentDunningJob(): Promise<void> {
  try {
    const queue = getInstallmentDunningQueue()
    const repeatable = await queue.getRepeatableJobs()
    const already = repeatable.some((j) => j.pattern === DAILY_CRON && j.name === 'installment-dunning')
    if (already) {
      logger.info('[installmentDunning] repeatable job already registered', { cron: DAILY_CRON })
      return
    }
    await queue.add('installment-dunning', {}, { repeat: { pattern: DAILY_CRON } })
    logger.info('[installmentDunning] registered repeatable job', { cron: DAILY_CRON })
  } catch (err) {
    logger.error('[installmentDunning] failed to register job', { error: String(err) })
  }
}
