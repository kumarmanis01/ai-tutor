import { Worker, Job } from 'bullmq'
import { redisConnection } from '../../lib/redis.js'
import { prisma } from '../../lib/prisma.js'
import { isSystemSettingEnabled } from '../../lib/systemSettings.js'
import { hydrateNotes } from '../../hydrators/hydrateNotes.js'
import { hydrateQuestions } from '../../hydrators/hydrateQuestions.js'
import { assembleTest } from '../../hydrators/assembleTest.js'
import { handleSyllabusJob } from '../services/syllabusWorker.js'
import { logger } from '../../lib/logger.js'

export function startContentWorker(opts?: { concurrency?: number }) {
  const concurrency = opts?.concurrency ?? 3

  const worker = new Worker(
    'content-hydration',
    async (job: Job) => {
      const paused = await prisma.systemSetting.findUnique({ where: { key: 'AI_PAUSED' } })
      if (isSystemSettingEnabled(paused?.value)) {
        throw new Error('AI_PAUSED')
      }

      try {
        const jobId = job.data?.payload?.jobId ?? job.data?.payload?.job_id ?? null
        if (jobId) {
          await prisma.executionJob.update({ where: { id: String(jobId) }, data: { status: 'running', lockedAt: new Date(), lockedBy: `worker:${process.pid}` } })
          await prisma.jobExecutionLog.create({ data: { jobId: String(jobId), event: 'RUNNING', prevStatus: 'pending', newStatus: 'running', meta: { workerPid: process.pid } } })
        }
      } catch (e) {
        logger?.warn?.('worker: failed to mark ExecutionJob RUNNING or create JobExecutionLog', { err: e })
      }

      const { type, payload } = job.data as {
        type: 'NOTES' | 'QUESTIONS' | 'ASSEMBLE_TEST' | 'SYLLABUS'
        payload: any
      }

      switch (type) {
        case 'NOTES': {
          const { topicId, language } = payload
          return hydrateNotes(topicId, language)
        }
        case 'QUESTIONS': {
          const { topicId, difficulty, language } = payload
          return hydrateQuestions(topicId, difficulty, language)
        }
        case 'SYLLABUS': {
          const { jobId } = payload || {}
          if (!jobId) throw new Error('SYLLABUS job missing jobId')
          return handleSyllabusJob(jobId)
        }
        case 'ASSEMBLE_TEST': {
          const { topicId } = payload
          return assembleTest(topicId)
        }
        default:
          throw new Error(`UNKNOWN_JOB_TYPE: ${type}`)
      }
    },
    {
      connection: {
        url: process.env.REDIS_URL!,
      },
      concurrency,
      settings: {
        backoffStrategy: (attemptsMade: number) => Math.min(60_000, 2 ** attemptsMade * 1000),
      },
    }
  )

  worker.on('failed', (job, err) => {
    logger.error(`[WORKER FAILED] jobId=${job?.id} type=${job?.data?.type}`, { error: err?.message })
    ;(async () => {
      try {
        const jobId = job?.data?.payload?.jobId ?? null
        if (jobId) {
          await prisma.executionJob.update({ where: { id: String(jobId) }, data: { status: 'failed', lastError: String(err?.message ?? err) } })
          await prisma.jobExecutionLog.create({ data: { jobId: String(jobId), event: 'FAILED', prevStatus: 'running', newStatus: 'failed', message: String(err?.message ?? err) } })
        }
      } catch (e) {
        logger?.warn?.('worker.failed: failed to mark executionJob failed or write JobExecutionLog', { err: e })
      }
    })()
  })

  worker.on('completed', job => {
    logger.info(`[WORKER COMPLETED] jobId=${job.id} type=${job.data?.type}`)
    ;(async () => {
      try {
        const jobId = job?.data?.payload?.jobId ?? null
        if (jobId) {
          await prisma.executionJob.update({ where: { id: String(jobId) }, data: { status: 'completed' } })
          await prisma.jobExecutionLog.create({ data: { jobId: String(jobId), event: 'COMPLETED', prevStatus: 'running', newStatus: 'completed' } })
        }
      } catch (e) {
        logger?.warn?.('worker.completed: failed to mark executionJob completed or write JobExecutionLog', { err: e })
      }
    })()
  })

  return worker
}
