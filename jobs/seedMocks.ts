import { Queue } from 'bullmq'
import { getSharedConnection } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const SEED_MOCKS_QUEUE_NAME = 'seed-mocks'

export interface SeedMocksJobData {
  minPer?: number
  subjectId?: string
  operatorId?: string
  dryRun?: boolean
}

let seedMocksQueue: Queue<SeedMocksJobData> | null = null

function getSeedMocksQueue() {
  if (!seedMocksQueue) {
    seedMocksQueue = new Queue(SEED_MOCKS_QUEUE_NAME, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 1,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    })
  }
  return seedMocksQueue
}

export async function enqueueSeedMocks(data: SeedMocksJobData) {
  const q = getSeedMocksQueue()
  try {
    const job = await q.add('seed-mocks', data)
    logger.info('[seed-mocks] enqueued', { jobId: job.id, payloadPreview: { minPer: data.minPer, subjectId: data.subjectId } })
    return { jobId: String(job.id), ok: true }
  } catch (err) {
    logger.error('[seed-mocks] enqueue failed', { error: String(err) })
    throw err
  }
}
