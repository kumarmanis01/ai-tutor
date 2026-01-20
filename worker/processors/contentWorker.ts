import { Worker, Job } from 'bullmq'
import { redisConnection } from '@/lib/redis.js'
import { prisma } from '@/lib/prisma.js'
import { isSystemSettingEnabled } from '@/lib/systemSettings.js'
import { JobStatus } from '@/lib/ai-engine/types'
// NOTE: This worker is currently syllabus-only; other hydrators are not imported here to
// avoid accidental module-scope side-effects.
import { handleSyllabusJob } from '@/worker/services/syllabusWorker'
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
      } catch {
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
  } catch (err) {
    logger?.warn?.('worker: failed during ExecutionJob START handling', { err: err })
    if (process.env.WORKER_DEBUG === '1') logger.error('[worker][DEBUG] failed to mark ExecutionJob STARTED', { error: err })
  }

  // New contract: prefer HydrationJob-based payloads. The canonical Bull payload
  // for syllabus is: { type: 'SYLLABUS', payload: { jobId: <HydrationJob.id> } }
  // Legacy payloads that contain an ExecutionJob id will be handled with a
  // WARN and translated into a HydrationJob (one-time compatibility).
  const payload = job.data?.payload ?? {}

  // Prefer `hydrationJobId` from canonical payload (payload.jobId)
  const incomingJobId = payload.jobId ?? payload.executionJobId ?? payload.job_id ?? null

  // Resolve to hydrationJobId (preferred) or attempt legacy ExecutionJob -> HydrationJob translation
  let hydrationJobId: string | null = null
  let executionJobId: string | null = null

  if (incomingJobId) {
    // First check if the incoming id corresponds to an existing HydrationJob
    const possibleHydration = await prisma.hydrationJob.findUnique({ where: { id: String(incomingJobId) } })
    if (possibleHydration) {
      hydrationJobId = possibleHydration.id
    } else {
      // Treat as legacy ExecutionJob id
      executionJobId = String(incomingJobId)
    }
  }

  if (!hydrationJobId && !executionJobId) {
    // No usable id provided — hard error per contract
    throw new Error('Missing required payload: hydration job id or execution job id')
  }

  // If legacy ExecutionJob was provided, translate it to a HydrationJob
  if (!hydrationJobId && executionJobId) {
    logger.warn('worker: received legacy ExecutionJob payload; creating HydrationJob', { executionJobId })
    const exec = await prisma.executionJob.findUnique({ where: { id: String(executionJobId) } })
    if (!exec) throw new Error('ExecutionJob not found for legacy payload')

    // Extract resolvedMeta from execution payload or JobExecutionLog meta if present
    const resolvedMeta = (exec.payload as any)?.resolvedMeta ?? (exec.payload as any) ?? {}

    // Determine subjectId (prefer ExecutionJob.entity when SUB JECT)
    const subjectId = exec.entityType === 'SUBJECT' ? exec.entityId : (resolvedMeta.subjectId ?? null)
    if (!subjectId) throw new Error('Missing subjectId in ExecutionJob legacy payload')

    // Idempotent: reuse pending/running hydration for same subject/board/grade
    let hydrate = await prisma.hydrationJob.findFirst({ where: { jobType: 'syllabus', subjectId: subjectId as string, status: { in: [JobStatus.Pending, JobStatus.Running] } } })
    if (!hydrate) {
      const jobData: any = {
        jobType: 'syllabus',
        subjectId: subjectId as string,
        language: resolvedMeta.language ?? (exec.payload as any)?.language ?? 'en',
        board: resolvedMeta.board ?? (exec.payload as any)?.board ?? null,
        grade: resolvedMeta.classLevel ?? (exec.payload as any)?.grade ?? null,
        subject: resolvedMeta.entityName ?? (exec.payload as any)?.subject ?? null,
        status: JobStatus.Pending,
      }
      hydrate = await prisma.hydrationJob.create({ data: jobData })
    }
    hydrationJobId = hydrate.id

    // Persist link ExecutionJob -> HydrationJob for audit
    try {
      await prisma.executionJob.update({ where: { id: String(executionJobId) }, data: { payload: { ...(exec.payload as any || {}), hydrationJobId } } })
    } catch (e) {
      logger?.warn?.('worker: failed to attach hydrationJobId to ExecutionJob payload', { err: e, executionJobId })
    }
  }

  // At this point we have a hydrationJobId to process
  if (!hydrationJobId) throw new Error('Failed to resolve HydrationJob id')

  // Mark HydrationJob RUNNING, then execute the canonical handler which will
  // load the HydrationJob row and perform data persistence.
  try {
    await prisma.hydrationJob.update({ where: { id: hydrationJobId }, data: { status: JobStatus.Running } })
  } catch (e) {
    logger?.warn?.('worker: failed to mark HydrationJob RUNNING', { err: e, hydrationJobId })
  }

  try {
    await handleSyllabusJob(hydrationJobId)

    // Verify that syllabus data was actually written: at least one chapter exists.
    const hydrateRow = await prisma.hydrationJob.findUnique({ where: { id: hydrationJobId } })
    const subjectId = hydrateRow?.subjectId ?? null
    if (!subjectId) {
      const err = new Error('HydrationJob missing subjectId after processing')
      await prisma.hydrationJob.update({ where: { id: hydrationJobId }, data: { status: JobStatus.Failed } }).catch(() => {})
      throw err
    }
    const chapter = await prisma.chapterDef.findFirst({ where: { subjectId: subjectId as string, lifecycle: 'active' } })
    if (!chapter) {
      const err = new Error('Syllabus generation produced no chapters')
      await prisma.hydrationJob.update({ where: { id: hydrationJobId }, data: { status: JobStatus.Failed } }).catch(() => {})
      throw err
    }

    // Mark HydrationJob completed
    await prisma.hydrationJob.update({ where: { id: hydrationJobId }, data: { status: JobStatus.Completed } })

    // If this run was triggered from an ExecutionJob, mark it completed too.
    // If we don't have an explicit ExecutionJob id in the payload, attempt
    // to discover a linked ExecutionJob whose payload contains `hydrationJobId`.
    if (executionJobId) {
      await prisma.executionJob.update({ where: { id: String(executionJobId) }, data: { status: 'completed', updatedAt: new Date() } })
      await prisma.jobExecutionLog.create({ data: { jobId: String(executionJobId), event: 'COMPLETED', prevStatus: 'running', newStatus: 'completed', meta: { hydrationJobId, bullJobId: job.id } } }).catch(() => {})
    } else {
      try {
        const linkedExec = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: hydrationJobId } } });
        if (linkedExec) {
          await prisma.executionJob.update({ where: { id: linkedExec.id }, data: { status: 'completed', updatedAt: new Date() } })
          await prisma.jobExecutionLog.create({ data: { jobId: String(linkedExec.id), event: 'COMPLETED', prevStatus: 'running', newStatus: 'completed', meta: { hydrationJobId, bullJobId: job.id } } }).catch(() => {})
        }
      } catch (e) {
        logger?.warn?.('worker: failed to mark linked ExecutionJob completed', { err: e, hydrationJobId })
      }
    }

    return { success: true }
  } catch (err: any) {
    // Mark HydrationJob failed
    try {
      await prisma.hydrationJob.update({ where: { id: hydrationJobId }, data: { status: JobStatus.Failed } })
    } catch (e) {
      logger?.warn?.('worker: failed to mark HydrationJob FAILED', { err: e, hydrationJobId })
    }
    // If we had an ExecutionJob context, mark it failed and write logs
    if (executionJobId) {
      try {
        await prisma.executionJob.update({ where: { id: String(executionJobId) }, data: { status: 'failed', lastError: String(err?.message ?? err) } })
        await prisma.jobExecutionLog.create({ data: { jobId: String(executionJobId), event: 'FAILED', prevStatus: 'running', newStatus: 'failed', message: String(err?.message ?? err), meta: { hydrationJobId, bullJobId: job.id, error: String(err?.message ?? err) } } })
      } catch (e) {
        logger?.warn?.('worker: failed to write failure state for ExecutionJob', { err: e, jobId: executionJobId })
      }
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

  worker.on('failed', async (job, err) => {
    logger.error(`[WORKER FAILED] jobId=${job?.id} type=${job?.data?.type}`, { error: err?.message });
    try {
        // Attempt to resolve whether the job payload refers to a HydrationJob
        // (preferred) or an ExecutionJob (legacy). If it's a HydrationJob, find
        // any ExecutionJob that references it and mark that as failed.
        const incomingId = job?.data?.payload?.executionJobId ?? job?.data?.payload?.jobId ?? null
        if (!incomingId) return

        const possibleHydration = await prisma.hydrationJob.findUnique({ where: { id: String(incomingId) } })
        if (possibleHydration) {
          // Find ExecutionJob that links to this hydration id
          const linkedExec = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: possibleHydration.id } } })
          if (linkedExec) {
            await prisma.executionJob.update({ where: { id: linkedExec.id }, data: { status: 'failed', lastError: String(err?.message ?? err) } })
            await prisma.jobExecutionLog.create({ data: { jobId: String(linkedExec.id), event: 'FAILED', prevStatus: 'running', newStatus: 'failed', message: String(err?.message ?? err), meta: { hydrationJobId: possibleHydration.id, bullJobId: job.id, error: String(err?.message ?? err) } } })
          }
        } else {
          const executionJobId = String(incomingId)
          await prisma.executionJob.update({ where: { id: executionJobId }, data: { status: 'failed', lastError: String(err?.message ?? err) } })
          await prisma.jobExecutionLog.create({ data: { jobId: executionJobId, event: 'FAILED', prevStatus: 'running', newStatus: 'failed', message: String(err?.message ?? err), meta: { bullJobId: job.id, error: String(err?.message ?? err) } } })
        }
    } catch (e) {
      logger?.warn?.('worker.failed: failed to mark executionJob failed or write JobExecutionLog', { err: e })
    }
  })

  worker.on('completed', async (job) => {
    logger.info(`[WORKER COMPLETED] jobId=${job.id} type=${job.data?.type}`);
    try {
      const incomingId = job?.data?.payload?.executionJobId ?? job?.data?.payload?.jobId ?? null
      if (!incomingId) return

      // Conservative completion: only mark ExecutionJob completed if we can
      // verify that actual syllabus content was produced. This avoids the
      // scenario where a legacy/incorrectly-enqueued Bull job causes the
      // ExecutionJob to advance despite missing HydrationJob rows or data.
      const possibleHydration = await prisma.hydrationJob.findUnique({ where: { id: String(incomingId) } })
      let resolvedHydrationId: string | null = null

      if (possibleHydration) {
        resolvedHydrationId = possibleHydration.id
      } else {
        // If payload was an ExecutionJob id, try to read its payload.hydrationJobId
        const execRow = await prisma.executionJob.findUnique({ where: { id: String(incomingId) } })
        if (execRow && execRow.payload && (execRow.payload as any).hydrationJobId) {
          resolvedHydrationId = String((execRow.payload as any).hydrationJobId)
        }
      }

      if (!resolvedHydrationId) {
        // No hydration linkage found; do not mark ExecutionJob completed.
        // Record an audit log so operators can investigate missing HydrationJobs.
        try {
          await prisma.jobExecutionLog.create({ data: { jobId: String(incomingId), event: 'COMPLETION_SKIPPED', prevStatus: 'running', newStatus: 'running', message: 'missing_hydration_job', meta: { bullJobId: job.id } } })
        } catch (e) {
          logger?.warn?.('worker.completed: failed to write COMPLETION_SKIPPED log', { err: e, incomingId })
        }
        logger.warn('[worker][WARN] completion skipped: no HydrationJob linked', { incomingId, bullJobId: job.id })
        return
      }

      // Verify that the hydration run produced at least one active chapter
      const hydrateRow = await prisma.hydrationJob.findUnique({ where: { id: resolvedHydrationId } })
      const subjectId = hydrateRow?.subjectId ?? null
      if (!subjectId) {
        // Missing subject linkage — treat as incomplete and log
        await prisma.jobExecutionLog.create({ data: { jobId: String(incomingId), event: 'COMPLETION_SKIPPED', prevStatus: 'running', newStatus: 'running', message: 'hydration_missing_subject', meta: { hydrationJobId: resolvedHydrationId, bullJobId: job.id } } }).catch(() => {})
        logger.warn('[worker][WARN] completion skipped: hydration missing subject', { hydrationJobId: resolvedHydrationId, bullJobId: job.id })
        return
      }

      const chapter = await prisma.chapterDef.findFirst({ where: { subjectId: subjectId as string, lifecycle: 'active' } })
      if (!chapter) {
        // No generated content — do not advance ExecutionJob automatically.
        await prisma.jobExecutionLog.create({ data: { jobId: String(incomingId), event: 'COMPLETION_SKIPPED', prevStatus: 'running', newStatus: 'running', message: 'no_generated_content', meta: { hydrationJobId: resolvedHydrationId, bullJobId: job.id } } }).catch(() => {})
        logger.warn('[worker][WARN] completion skipped: no generated chapters', { hydrationJobId: resolvedHydrationId, bullJobId: job.id })
        return
      }

      // Safe to mark ExecutionJob completed. Find linked ExecutionJob (if any)
      const linkedExec = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: resolvedHydrationId } } })
      if (linkedExec) {
        await prisma.executionJob.update({ where: { id: linkedExec.id }, data: { status: 'completed' } })
        await prisma.jobExecutionLog.create({ data: { jobId: String(linkedExec.id), event: 'COMPLETED', prevStatus: 'running', newStatus: 'completed', meta: { hydrationJobId: resolvedHydrationId, bullJobId: job.id } } }).catch(() => {})
      } else {
        const executionJobId = String(incomingId)
        await prisma.executionJob.update({ where: { id: executionJobId }, data: { status: 'completed' } })
        await prisma.jobExecutionLog.create({ data: { jobId: executionJobId, event: 'COMPLETED', prevStatus: 'running', newStatus: 'completed', meta: { bullJobId: job.id } } }).catch(() => {})
      }
    } catch (e) {
      logger?.warn?.('worker.completed: failed to mark executionJob completed or write JobExecutionLog', { err: e })
    }
  })

  return worker
}
