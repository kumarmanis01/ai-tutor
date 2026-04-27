import { getContentQueue } from "@/queues/contentQueue";
import { logger } from "@/lib/logger";

const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1'

// Enqueue test hydration jobs
export async function enqueueTestHydration(testId: string) {
  const q = getContentQueue()
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] enqueueTestHydration called', { testId })

  const job = await q.add(`test-${testId}`, { type: 'ASSEMBLE_TEST', payload: { testId } })
  logger.info('enqueueTestHydration enqueued', { testId, jobId: job.id })
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] enqueued test job', { testId, jobId: job.id })
  return job.id
}
