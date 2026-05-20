/**
 * FILE OBJECTIVE:
 * - BullMQ worker that consumes the analytics-ingest queue and writes one
 *   AnalyticsEvent row per job via prisma.analyticsEvent.create().
 * - Concurrency is controlled by ANALYTICS_INGEST_BATCH_SIZE (default 500)
 *   so up to 500 jobs run in parallel, achieving bulk throughput without
 *   requiring a createMany batch accumulator.
 * - Retry behaviour: BullMQ retries failed jobs up to 3 times with exponential
 *   backoff (configured in analyticsQueue.ts). On retry a duplicate row may be
 *   created; this is acceptable for analytics (minor over-count is preferable to
 *   dropped events). If strict deduplication is required, add a unique constraint
 *   on (eventType, userId, createdAt) or use a client-supplied idempotency key.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/analyticsIngestWorker.test.ts
 *
 * EDIT LOG:
 * - 2026-04-21 | staff-engineer | Task D: analytics ingest worker
 * - 2026-04-21 | staff-engineer | review fix: correct header (per-job create, not createMany); add test
 * - 2026-05-20T00:00:00Z | copilot | reduce default concurrency 500->50 (ANALYTICS_INGEST_CONCURRENCY) to prevent DB pool exhaustion
 */

import { Worker, Job } from 'bullmq'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { redisConnection } from '../../lib/redis'
import { ANALYTICS_INGEST_QUEUE } from '../../lib/queues/constants'

export type AnalyticsIngestPayload = {
  eventType: string
  userId: string | null
  courseId: string | null
  lessonIdx: number | null
  metadata: Prisma.InputJsonValue
}

export async function processAnalyticsIngest(job: Job<AnalyticsIngestPayload>): Promise<void> {
  const { eventType, userId, courseId, lessonIdx, metadata } = job.data
  await prisma.analyticsEvent.create({
    data: {
      eventType,
      userId: userId ?? null,
      courseId: courseId ?? null,
      lessonIdx: lessonIdx ?? null,
      metadata: metadata ?? {},
    },
  })
}

export function startAnalyticsIngestWorker(): Worker {
  // ANALYTICS_INGEST_CONCURRENCY: number of analytics jobs processed in parallel.
  // Each concurrent job holds one DB connection; keep well below the pool limit (default: 10).
  // Raise only if the DB pool (DATABASE_CONNECTION_LIMIT) is explicitly increased.
  const concurrency = Number(process.env.ANALYTICS_INGEST_CONCURRENCY || 50)

  const worker = new Worker<AnalyticsIngestPayload>(
    ANALYTICS_INGEST_QUEUE,
    async (job) => {
      try {
        await processAnalyticsIngest(job)
      } catch (err) {
        logger.warn('analyticsIngestWorker: job failed', {
          event: 'analytics_ingest_job_failed',
          context: { jobId: job.id, eventType: job.data.eventType, error: String(err) },
        })
        throw err
      }
    },
    {
      connection: redisConnection,
      concurrency,
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 50 },
    },
  )

  worker.on('failed', (job, err) => {
    logger.warn('analyticsIngestWorker: worker-level failure', {
      event: 'analytics_ingest_worker_failed',
      context: { jobId: job?.id, error: String(err) },
    })
  })

  logger.info('analyticsIngestWorker: started', {
    event: 'analytics_ingest_worker_started',
    context: { queue: ANALYTICS_INGEST_QUEUE, concurrency },
  })

  return worker
}
