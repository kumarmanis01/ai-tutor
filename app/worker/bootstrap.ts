import { startContentWorker } from './content.worker'
import { logger } from '@/lib/logger'

export async function bootstrapWorker() {
  logger.info('[worker] bootstrapping...')

  if (!process.env.REDIS_URL) {
    logger.error('REDIS_URL is not set')
    throw new Error('REDIS_URL is not set')
  }

  // Start the content worker (BullMQ). startContentWorker() returns the
  // worker instance; we intentionally don't await anything here so that the
  // process can continue to run and PM2 can manage lifecycle.
  startContentWorker()

  logger.info('[worker] bootstrap complete')
}
