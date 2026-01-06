import { Worker } from 'bullmq'
import { getRedis } from '../lib/redis'
import { CONTENT_QUEUE } from './queues'

export function startContentWorker() {
	const worker = new Worker(
		CONTENT_QUEUE,
		async (job) => {
			console.log(`[worker] picked job ${job.id}`, job.data)

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
		console.log('[worker] content worker ready')
	})

	worker.on('failed', (job, err) => {
		console.error('[worker] job failed', job?.id, err)
	})

	worker.on('error', (err) => {
		console.error('[worker] worker error', err)
	})

	return worker
}
