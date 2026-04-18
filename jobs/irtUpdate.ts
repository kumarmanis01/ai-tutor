import { Queue } from 'bullmq'
import { getSharedConnection } from '@/lib/redis'
import { logger } from '@/lib/logger'

export interface IRTUpdateJobData {
  studentId: string
  conceptId: string
  questionId: string
  sessionId: string
  isCorrect: boolean
  itemDifficulty: number
  studentAnswer?: string
}

export const IRT_UPDATE_QUEUE_NAME = 'irt-update'

let irtUpdateQueue: Queue<IRTUpdateJobData> | null = null

export function getIRTUpdateQueue(): Queue<IRTUpdateJobData> {
  if (!irtUpdateQueue) {
    irtUpdateQueue = new Queue<IRTUpdateJobData>(IRT_UPDATE_QUEUE_NAME, {
      connection: getSharedConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    })
  }
  return irtUpdateQueue
}

export async function enqueueIRTUpdate(data: IRTUpdateJobData): Promise<void> {
  try {
    const queue = getIRTUpdateQueue()
    await queue.add('update-theta', data)
  } catch (err) {
    logger.error('[irt-update] enqueue failed', {
      error: String((err as any)?.message ?? err),
      studentId: data.studentId,
      conceptId: data.conceptId,
    })
  }
}
