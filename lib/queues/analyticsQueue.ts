/**
 * FILE OBJECTIVE:
 * - Lazy-initialized BullMQ Queue for analytics event ingestion.
 * - Gracefully returns null when REDIS_URL is absent so tests and non-worker
 *   contexts can import without crashing.
 *
 * EDIT LOG:
 * - 2026-04-21 | staff-engineer | Task D: non-blocking analytics ingestion
 */

import { Queue } from 'bullmq'
import { getSharedConnection } from '../redis'
import { ANALYTICS_INGEST_QUEUE } from './constants'

let _queue: Queue | null = null

export function getAnalyticsQueue(): Queue | null {
  if (!process.env.REDIS_URL) return null
  if (!_queue) {
    _queue = new Queue(ANALYTICS_INGEST_QUEUE, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 200,
        removeOnFail: 50,
      },
    })
  }
  return _queue
}
