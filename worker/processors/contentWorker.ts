import { Worker, Job } from 'bullmq'
import { redisConnection } from '@/lib/redis.js'
import { prisma } from '@/lib/prisma.js'
import { isSystemSettingEnabled } from '@/lib/systemSettings.js'
import { JobStatus } from '@/lib/ai-engine/types'
import { hydrateNotes } from '@/hydrators/hydrateNotes'
import { hydrateQuestions } from '@/hydrators/hydrateQuestions'
import { assembleTest } from '@/hydrators/assembleTest'
import { handleSyllabusJob } from '../services/syllabusWorker.js'
import { logger } from '@/lib/logger.js'

export async function processContentJob(job: Job) {
  if (process.env.WORKER_DEBUG === '1') {
    try {
      logger.info(`[worker][DEBUG] received job id=${job.id} name=${job.name} data=${JSON.stringify(job.data)}`);
    } catch (e) {
      logger.error('[worker][DEBUG] received job (failed to stringify)', { error: e });
    }
  }
  const paused = await prisma.systemSetting.findUnique({ where: { key: 'AI_PAUSED' } })
  if (isSystemSettingEnabled(paused?.value)) {
    throw new Error('AI_PAUSED')
  }

  // Canonical execution job id in payload: `executionJobId` (fallback to legacy `jobId`)
  try {
    const executionJobId = job.data?.payload?.executionJobId ?? job.data?.payload?.jobId ?? job.data?.payload?.job_id ?? null
    if (executionJobId) {
      if (process.env.WORKER_DEBUG === '1') logger.debug(`[worker][DEBUG] marking ExecutionJob ${executionJobId} as running`)

      // Read prev status for log context
      let prevStatus: string | null = null
      try {
        const ex = await prisma.executionJob.findUnique({ where: { id: String(executionJobId) } })
        prevStatus = ex?.status ?? null
      } catch (e) {
        // ignore read errors, proceed to update
      }

      // Mark execution job as running (idempotent enough for retries)
      try {
        await prisma.executionJob.update({ where: { id: String(executionJobId) }, data: { status: 'running', lockedAt: new Date(), lockedBy: `worker:${process.pid}` } })
      } catch (e) {
        logger?.warn?.('worker: failed to mark ExecutionJob RUNNING', { err: e, jobId: executionJobId })
      }

      // Emit STARTED log (do not fail worker if logging fails)
      try {
        await prisma.jobExecutionLog.create({ data: { jobId: String(executionJobId), event: 'STARTED', prevStatus: prevStatus, newStatus: 'running', meta: { bullJobId: job.id, workerPid: process.pid } } })
      } catch (e) {
        logger?.warn?.('worker: failed to create JobExecutionLog STARTED', { err: e, jobId: executionJobId })
      }
    }
  } catch (e) {
    logger?.warn?.('worker: failed during ExecutionJob START handling', { err: e })
    if (process.env.WORKER_DEBUG === '1') logger.error('[worker][DEBUG] failed to mark ExecutionJob STARTED', { error: e })
  }

  // Strict syllabus-only execution: treat every job as a syllabus generation job.
  const payload = job.data?.payload ?? {}

  // 1) Validate required payload fields per requirements
  const executionJobId = payload.executionJobId ?? payload.jobId ?? null
  const resolvedMeta = payload.resolvedMeta ?? null
  if (!executionJobId) {
    throw new Error('Missing required payload field: executionJobId')
  }
  if (!resolvedMeta || typeof resolvedMeta !== 'object') {
    throw new Error('Missing required payload field: resolvedMeta')
  }

  // Execution flow: claim ExecutionJob, ensure HydrationJob exists for subject,
  // run syllabus generation, verify persisted data, finalize ExecutionJob.
  const exec = await prisma.executionJob.findUnique({ where: { id: String(executionJobId) } })
  if (!exec) throw new Error('ExecutionJob not found for executionJobId')

  // Determine subjectId: prefer ExecutionJob.entityId when entityType=SUBJECT,
  // otherwise require resolvedMeta.subjectId.
  const subjectId = exec.entityType === 'SUBJECT' ? exec.entityId : (resolvedMeta.subjectId ?? null)
  if (!subjectId) throw new Error('Missing subjectId in ExecutionJob or resolvedMeta')

  // Ensure a HydrationJob exists to process the syllabus; reuse pending/running,
  // else create one using resolvedMeta.
  let hydrate = await prisma.hydrationJob.findFirst({ where: { jobType: 'syllabus', subjectId: subjectId as string, status: { in: [JobStatus.Pending, JobStatus.Running] } } })
  if (!hydrate) {
    const jobData: any = {
      jobType: 'syllabus',
      subjectId: subjectId as string,
      language: (resolvedMeta as any).language ?? (exec.payload as any)?.language ?? 'en',
      board: (resolvedMeta as any).board ?? (exec.payload as any)?.board ?? null,
      grade: (resolvedMeta as any).classLevel ?? (exec.payload as any)?.grade ?? null,
      subject: (resolvedMeta as any).entityName ?? (exec.payload as any)?.subject ?? null,
      status: JobStatus.Pending
    }
    hydrate = await prisma.hydrationJob.create({ data: jobData })
  }

  // Run syllabus generation and enforce success/failure semantics strictly.
  try {
    await handleSyllabusJob(hydrate.id)

    // Verify that syllabus data was actually written: at least one chapter exists.
    const chapter = await prisma.chapterDef.findFirst({ where: { subjectId: subjectId as string, lifecycle: 'active' } })
    if (!chapter) {
      const err = new Error('Syllabus generation produced no chapters')
      // Mark execution job failed and rethrow
      await prisma.executionJob.update({ where: { id: String(executionJobId) }, data: { status: 'failed', lastError: String(err.message) } })
      await prisma.jobExecutionLog.create({ data: { jobId: String(executionJobId), event: 'FAILED', prevStatus: 'running', newStatus: 'failed', message: String(err.message), meta: { bullJobId: job.id } } })
      throw err
    }

    // Success: finalize ExecutionJob
    await prisma.executionJob.update({ where: { id: String(executionJobId) }, data: { status: 'completed', updatedAt: new Date() } })
    await prisma.jobExecutionLog.create({ data: { jobId: String(executionJobId), event: 'COMPLETED', prevStatus: 'running', newStatus: 'completed', meta: { bullJobId: job.id } } })
    return { success: true }
  } catch (err: any) {
    // On any error, mark ExecutionJob failed and rethrow so Bull marks job failed.
    try {
      await prisma.executionJob.update({ where: { id: String(executionJobId) }, data: { status: 'failed', lastError: String(err?.message ?? err) } })
      await prisma.jobExecutionLog.create({ data: { jobId: String(executionJobId), event: 'FAILED', prevStatus: 'running', newStatus: 'failed', message: String(err?.message ?? err), meta: { bullJobId: job.id, error: String(err?.message ?? err) } } })
    } catch (e) {
      logger?.warn?.('worker: failed to write failure state for ExecutionJob', { err: e, jobId: executionJobId })
    }
    throw err
  }
}

export function startContentWorker(opts?: { concurrency?: number }) {
  const concurrency = opts?.concurrency ?? 3
  const worker = new Worker('content-hydration', (job: Job) => processContentJob(job), {
    connection: redisConnection,
    concurrency,
    settings: {
      backoffStrategy: (attemptsMade: number) => Math.min(60_000, 2 ** attemptsMade * 1000),
    },
  })

  worker.on('failed', (job, err) => {
    logger.error(`[WORKER FAILED] jobId=${job?.id} type=${job?.data?.type}`, { error: err?.message });
    (async () => {
      try {
        const executionJobId = job?.data?.payload?.executionJobId ?? job?.data?.payload?.jobId ?? null
        if (executionJobId) {
          await prisma.executionJob.update({ where: { id: String(executionJobId) }, data: { status: 'failed', lastError: String(err?.message ?? err) } })
          await prisma.jobExecutionLog.create({ data: { jobId: String(executionJobId), event: 'FAILED', prevStatus: 'running', newStatus: 'failed', message: String(err?.message ?? err), meta: { bullJobId: job.id, error: String(err?.message ?? err) } } })
        }
      } catch (e) {
        logger?.warn?.('worker.failed: failed to mark executionJob failed or write JobExecutionLog', { err: e })
      }
    })()
  })

  worker.on('completed', job => {
    logger.info(`[WORKER COMPLETED] jobId=${job.id} type=${job.data?.type}`);
    (async () => {
      try {
        const executionJobId = job?.data?.payload?.executionJobId ?? job?.data?.payload?.jobId ?? null
        if (executionJobId) {
          await prisma.executionJob.update({ where: { id: String(executionJobId) }, data: { status: 'completed' } })
          await prisma.jobExecutionLog.create({ data: { jobId: String(executionJobId), event: 'COMPLETED', prevStatus: 'running', newStatus: 'completed', meta: { bullJobId: job.id } } })
        }
      } catch (e) {
        logger?.warn?.('worker.completed: failed to mark executionJob completed or write JobExecutionLog', { err: e })
      }
    })()
  })

  return worker
}
