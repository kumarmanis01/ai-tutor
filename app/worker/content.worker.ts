import { Worker } from 'bullmq'
import { getRedis } from '@/lib/redis'
import { CONTENT_QUEUE } from './queues'
import { logger } from '@/lib/logger'

export function startContentWorker() {
	const worker = new Worker(
		CONTENT_QUEUE,
		async (job) => {
			logger.info(`[worker] picked job ${job.id}`, { data: job.data })

			// 🔴 your actual AI / content logic here
			await new Promise((res) => setTimeout(res, 500))

			return { success: true }
		},
		{
			connection: getRedis(),
			concurrency: 2,
		}
	)

	worker.on('ready', () => {
		logger.info('[worker] content worker ready')
	})

	worker.on('failed', (job, err) => {
		logger.error('[worker] job failed', { jobId: job?.id, error: err?.message ?? String(err) })
	})

	worker.on('error', (err) => {
		logger.error('[worker] worker error', { error: err?.message ?? String(err) })
	})

	return worker
}
