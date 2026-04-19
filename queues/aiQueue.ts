/**
 * Lazy queue factory for AI request jobs.
 *
 * Use `getAIRequestQueue()` from API handlers to enqueue work that must run
 * in worker context (LLM calls are restricted to workers).
 */
/**
 * EDIT LOG:
 * - 2026-04-18T18:00:00Z | copilot | use getSharedConnection() to share IORedis singleton
 */
import { Queue } from 'bullmq'
import { getSharedConnection } from '@/lib/redis'
import { AI_REQUEST_QUEUE } from '@/lib/queues/constants'

let _aiQueue: Queue | null = null

function getConnection() {
  // Returns the shared IORedis singleton rather than ConnectionOptions.
  return getSharedConnection()
}

export function getAIRequestQueue() {
  if (!_aiQueue) {
    _aiQueue = new Queue(AI_REQUEST_QUEUE, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    })
  }
  return _aiQueue
}

export default getAIRequestQueue
