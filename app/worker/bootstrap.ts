import { startContentWorker } from './content.worker'

export async function bootstrapWorker() {
  console.log('[worker] bootstrapping...')

  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is not set')
  }

  // Start the content worker (BullMQ). startContentWorker() returns the
  // worker instance; we intentionally don't await anything here so that the
  // process can continue to run and PM2 can manage lifecycle.
  startContentWorker()

  console.log('[worker] bootstrap complete')
}
