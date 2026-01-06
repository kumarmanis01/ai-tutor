import { Queue } from 'bullmq'
import { getRedis } from '../lib/redis'

export const CONTENT_QUEUE = 'content-engine'

export function createContentQueue() {
	return new Queue(CONTENT_QUEUE, {
		connection: getRedis(),
		defaultJobOptions: {
			attempts: 3,
			backoff: {
				type: 'exponential',
				delay: 5000,
			},
			removeOnComplete: 100,
			removeOnFail: 50,
		},
	})
}
