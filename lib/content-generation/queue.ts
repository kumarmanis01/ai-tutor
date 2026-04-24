/**
 * FILE OBJECTIVE:
 * - BullMQ Queue factory for the AI content generation pipeline.
 *   Lazy-initialized to avoid Redis connections at import time.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/content-generation/queue.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created — B4.1 content generation queue
 */

import { Queue } from 'bullmq'
import { getSharedConnection } from '@/lib/redis'
import {
  type ContentGenerationJobData,
  CONTENT_GENERATION_QUEUE,
} from '@/worker/processors/contentGenerationWorker'

export { CONTENT_GENERATION_QUEUE } from '@/worker/processors/contentGenerationWorker'

let _queue: Queue<ContentGenerationJobData> | null = null

export function getContentGenerationQueue(): Queue<ContentGenerationJobData> {
  if (!_queue) {
    _queue = new Queue<ContentGenerationJobData>(CONTENT_GENERATION_QUEUE, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    })
  }
  return _queue
}
