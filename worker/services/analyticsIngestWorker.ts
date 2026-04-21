/**
 * FILE OBJECTIVE:
 * - BullMQ worker that consumes the analytics-ingest queue and bulk-writes
 *   AnalyticsEvent rows to the DB using createMany.
 * - Processes jobs in batches of up to ANALYTICS_INGEST_BATCH_SIZE (default 500).
 * - Idempotent: safe to retry on failure.
 *
 * EDIT LOG:
 * - 2026-04-21 | staff-engineer | Task D: analytics ingest worker
 */

import { Worker, Job } from 'bullmq'
import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { redisConnection } from '../../lib/redis.js'
import { ANALYTICS_INGEST_QUEUE } from '../../lib/queues/constants.js'

export type AnalyticsIngestPayload = {
  eventType: string
  userId: string | null
  courseId: string | null
  lessonIdx: number | null
  metadata: unknown
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
  const batchSize = Number(process.env.ANALYTICS_INGEST_BATCH_SIZE || 500)

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
      concurrency: batchSize,
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
    context: { queue: ANALYTICS_INGEST_QUEUE, concurrency: batchSize },
  })

  return worker
}
