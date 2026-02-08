/**
 * FILE OBJECTIVE:
 * - Content hydration worker processor that handles all job types (SYLLABUS, NOTES, QUESTIONS, ASSEMBLE_TEST).
 * - Dispatches to appropriate worker service handlers based on job type.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/processors/contentWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/AI_Execution_pipeline.md
 *
 * EDIT LOG:
 * - 2026-01-20T00:00:00Z | unknown | Added syllabus-only processing
 * - 2026-01-22T02:35:00Z | copilot | Phase 3: Generalized to handle all job types
 */

import { Worker, Job } from 'bullmq'
import { redisConnection } from '@/lib/redis.js'
import { prisma } from '@/lib/prisma.js'
import { randomUUID } from 'crypto'
import { isSystemSettingEnabled } from '@/lib/systemSettings.js'
import { JobStatus } from '@/lib/ai-engine/types'
// Worker service handlers for different job types
import { handleSyllabusJob } from '@/worker/services/syllabusWorker'
import { handleNotesJob } from '@/worker/services/notesWorker'
import { handleQuestionsJob } from '@/worker/services/questionsWorker'
import { handleAssembleJob } from '@/worker/services/assembleWorker'
import { logger } from '@/lib/logger.js'

/**
 * Supported worker types and their handlers.
 * Maps Bull job data.type to the appropriate handler function.
 */
const WORKER_HANDLERS: Record<string, (jobId: string) => Promise<void>> = {
  SYLLABUS: handleSyllabusJob,
  NOTES: handleNotesJob,
  QUESTIONS: handleQuestionsJob,
  ASSEMBLE_TEST: handleAssembleJob,
};

/*
  NOTE (incident 2026-01-20):
  - Observed behavior: a HydrationJob completed and persisted chapter rows, but the
    corresponding ExecutionJob remained in state PENDING in the DB and the UI.
  - Root-cause hypotheses:
    * The worker's completion path previously relied on the Bull job payload
      (which may contain a legacy ExecutionJob id) to discover the HydrationJob.
      In some runs the ExecutionJob payload did not yet contain `hydrationJobId`
      (race between creating/updating ExecutionJob and the subsequent Bull job),
      so the completed HydrationJob was not discovered by the completion handler.
    * Another possibility is the completion handler executed earlier than the
      persistence of chapter rows (race between LLM persistence and completion check),
      so the safety check "at least one chapter exists" failed and completion was
      intentionally skipped.
    * A worker restart/crash between HydrationJob persistence and the ExecutionJob
      update could also cause the ExecutionJob update to be missed.
  - Remediation performed:
    * The completion logic was made conservative: the worker now verifies a
      linked HydrationJob and checks for at least one active `chapterDef` row
      before advancing the ExecutionJob. This prevents false-positive completion
      when no DB evidence exists.
    * For the specific incident the ExecutionJob was manually marked COMPLETED
      after confirming the LLM response (AIContentLog) and 13 persisted chapters.
  - Operational recommendation: when reproducing, restart the worker with
    `WORKER_DEBUG=1` and tail worker logs while enqueuing a new job to capture
    the exact timing/race that previously allowed the miss.
*/

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

      // Emit STARTED log (do not mutate ExecutionJob; only write an audit log)
      try {
        await prisma.jobExecutionLog.create({ data: { jobId: String(executionJobId), event: 'STARTED', prevStatus: prevStatus, newStatus: prevStatus, meta: { bullJobId: job.id, workerPid: process.pid } } })
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
      const generatedId = randomUUID();
      hydrate = await prisma.hydrationJob.create({ data: { id: generatedId, rootJobId: generatedId, ...jobData } })
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

  // Determine the job type from Bull job data
  const workerType = job.data?.type ?? 'SYLLABUS'; // Default to SYLLABUS for backward compatibility
  const handler = WORKER_HANDLERS[workerType];

  // Admin kill-switches: global and per-job-type disables
  try {
    const globalDisabled = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_DISABLED' } });
    if (isSystemSettingEnabled(globalDisabled?.value)) {
      throw new Error('HYDRATION_DISABLED');
    }
    const perKey = `HYDRATION_DISABLED_${workerType}`;
    const perDisabled = await prisma.systemSetting.findUnique({ where: { key: perKey } });
    if (isSystemSettingEnabled(perDisabled?.value)) {
      throw new Error(`HYDRATION_DISABLED_${workerType}`);
    }
  } catch (e) {
    // Bubble up to worker failure handling so logs and lastError are recorded
    throw e;
  }

  if (!handler) {
    const err = new Error(`Unknown worker type: ${workerType}`);
    logger.error('worker: unknown worker type', { workerType, hydrationJobId });
    try {
      const { formatLastError, FailureCode } = await import('@/lib/failureCodes');
      const le = formatLastError(FailureCode.PROMPT_INVALID, err.message);
      await prisma.hydrationJob.update({ where: { id: hydrationJobId }, data: { status: JobStatus.Failed, lastError: le } })
    } catch { /* ignore */ }
    throw err;
  }

  if (process.env.WORKER_DEBUG === '1') {
    logger.debug(`[worker][DEBUG] dispatching to handler`, { workerType, hydrationJobId });
  }

  // Mark HydrationJob RUNNING, then execute the appropriate handler which will
  // load the HydrationJob row and perform data persistence.
  // Handlers are responsible for claiming the HydrationJob (atomic updateMany
  // where status === Pending). Do not pre-mark RUNNING here to avoid race
  // with handler-level claims and to keep a single source of truth for attempts.

  try {
    // Dispatch to the appropriate handler based on worker type. Handlers must
    // perform the atomic claim (updateMany) and set lockedAt on claim.
    await handler(hydrationJobId);

    // After handler returns, perform verification by reading the HydrationJob
    const hydrateRow = await prisma.hydrationJob.findUnique({ where: { id: hydrationJobId } })
    if (hydrateRow?.contentReady) {
      return { success: true }
    }

    // Type-specific completion verification
    if (workerType === 'SYLLABUS') {
      // For syllabus: verify at least one chapter was created
      const subjectId = hydrateRow?.subjectId ?? null
      if (!subjectId) {
        const err = new Error('HydrationJob missing subjectId after processing')
        await prisma.hydrationJob.update({ where: { id: hydrationJobId }, data: { status: JobStatus.Failed } }).catch(() => {})
        throw err
      }

      // Short retry/backoff to tolerate small commit ordering races
      let chapter = null
      const maxAttempts = 5
      let attempt = 0
      while (attempt < maxAttempts) {
        chapter = await prisma.chapterDef.findFirst({ where: { subjectId: subjectId as string, lifecycle: 'active' } })
        if (chapter) break
        const delay = Math.min(2000, 100 * 2 ** attempt)
        await new Promise((r) => setTimeout(r, delay))
        attempt += 1
      }
      if (!chapter) {
        const err = new Error('Syllabus generation produced no chapters')
        await prisma.hydrationJob.update({ where: { id: hydrationJobId }, data: { status: JobStatus.Failed } }).catch(() => {})
        throw err
      }
    } else if (workerType === 'NOTES') {
      // For notes: verify TopicNote was created
      const topicId = hydrateRow?.topicId ?? null
      if (topicId) {
        const note = await prisma.topicNote.findFirst({ where: { topicId } })
        if (!note) {
          logger.warn('worker: notes handler completed but no TopicNote found', { hydrationJobId, topicId })
        }
      }
    } else if (workerType === 'QUESTIONS') {
      // For questions: verify GeneratedTest was created
      const topicId = hydrateRow?.topicId ?? null
      if (topicId) {
        const test = await prisma.generatedTest.findFirst({ where: { topicId } })
        if (!test) {
          logger.warn('worker: questions handler completed but no GeneratedTest found', { hydrationJobId, topicId })
        }
      }
    }
    // ASSEMBLE_TEST doesn't create new content, just approves existing

    // Mark HydrationJob completed (handler may already have done this; idempotent)
    await prisma.hydrationJob.update({ where: { id: hydrationJobId }, data: { status: JobStatus.Completed, completedAt: new Date(), contentReady: true } })

    // Emit COMPLETED JobExecutionLog entries for any linked ExecutionJob but DO NOT mutate ExecutionJob
    if (executionJobId) {
      try {
        await prisma.jobExecutionLog.create({ data: { jobId: String(executionJobId), event: 'COMPLETED', prevStatus: 'running', newStatus: 'running', meta: { hydrationJobId, bullJobId: job.id, workerType } } }).catch(() => {})
      } catch {}
    } else {
      try {
        const linkedExec = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: hydrationJobId } } });
        if (linkedExec) {
          await prisma.jobExecutionLog.create({ data: { jobId: String(linkedExec.id), event: 'COMPLETED', prevStatus: 'running', newStatus: 'running', meta: { hydrationJobId, bullJobId: job.id, workerType } } }).catch(() => {})
        }
      } catch (e) {
        logger?.warn?.('worker: failed to write COMPLETED JobExecutionLog for linked ExecutionJob', { err: e, hydrationJobId })
      }
    }

    return { success: true }
  } catch (err: any) {
    // Mark HydrationJob failed and persist AIContentLog for observability.
    try {
      const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
      const code = inferFailureCodeFromMessage(String(err?.message ?? ''));
      const le = formatLastError(code, String(err?.message ?? err));
      await prisma.hydrationJob.update({ where: { id: hydrationJobId }, data: { status: JobStatus.Failed, lastError: le, lockedAt: null } })
      try {
        await prisma.aIContentLog.create({ data: { model: 'none', promptType: 'dispatcher', language: 'en', success: false, status: 'failed', error: le, requestBody: job.data?.payload ?? null, responseBody: { error: String(err?.message ?? err) } } });
      } catch {}
    } catch (e) {
      logger?.warn?.('worker: failed to mark HydrationJob FAILED', { err: e, hydrationJobId })
    }

    // If we had an ExecutionJob context, emit FAILED JobExecutionLog for observability (do not mutate ExecutionJob state here)
    if (executionJobId) {
      try {
        const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
        const code = inferFailureCodeFromMessage(String(err?.message ?? ''));
        const le = formatLastError(code, String(err?.message ?? err));
        await prisma.jobExecutionLog.create({ data: { jobId: String(executionJobId), event: 'FAILED', prevStatus: 'running', newStatus: 'running', message: le, meta: { hydrationJobId, bullJobId: job.id, error: le } } }).catch(() => {});
      } catch (e) {
        logger?.warn?.('worker: failed to write failure JobExecutionLog for ExecutionJob', { err: e, jobId: executionJobId });
      }
    }

    // Swallow exception so the Bull job is not automatically retried for the same HydrationJob.
    logger.error('handler failed; HydrationJob marked failed', { hydrationJobId, error: String(err?.message ?? err) });
    return { success: false };
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
        // (preferred) or an ExecutionJob (legacy). Emit audit logs but do NOT
        // mutate ExecutionJob state from the worker process.
        const incomingId = job?.data?.payload?.executionJobId ?? job?.data?.payload?.jobId ?? null
        if (!incomingId) return

        const possibleHydration = await prisma.hydrationJob.findUnique({ where: { id: String(incomingId) } })
        if (possibleHydration) {
          // Find ExecutionJob that links to this hydration id and emit FAILED log
          const linkedExec = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: possibleHydration.id } } })
          if (linkedExec) {
            try {
              const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
              const code = inferFailureCodeFromMessage(String(err?.message ?? ''));
              const le = formatLastError(code, String(err?.message ?? err));
              await prisma.jobExecutionLog.create({ data: { jobId: String(linkedExec.id), event: 'FAILED', prevStatus: linkedExec.status, newStatus: linkedExec.status, message: le, meta: { hydrationJobId: possibleHydration.id, bullJobId: job.id, error: le } } })
            } catch {
              await prisma.jobExecutionLog.create({ data: { jobId: String(linkedExec.id), event: 'FAILED', prevStatus: linkedExec.status, newStatus: linkedExec.status, message: String(err?.message ?? err), meta: { hydrationJobId: possibleHydration.id, bullJobId: job.id, error: String(err?.message ?? err) } } })
            }
          }
        } else {
          const executionJobId = String(incomingId)
          try {
            const { formatLastError, inferFailureCodeFromMessage } = await import('@/lib/failureCodes');
            const code = inferFailureCodeFromMessage(String(err?.message ?? ''));
            const le = formatLastError(code, String(err?.message ?? err));
            // Emit FAILED log for legacy ExecutionJob id; do not update its state here.
            await prisma.jobExecutionLog.create({ data: { jobId: executionJobId, event: 'FAILED', prevStatus: 'running', newStatus: 'running', message: le, meta: { bullJobId: job.id, error: le } } }).catch(() => {})
          } catch {
            await prisma.jobExecutionLog.create({ data: { jobId: executionJobId, event: 'FAILED', prevStatus: 'running', newStatus: 'running', message: String(err?.message ?? err), meta: { bullJobId: job.id, error: String(err?.message ?? err) } } }).catch(() => {})
          }
        }
    } catch (e) {
      logger?.warn?.('worker.failed: failed to write JobExecutionLog', { err: e })
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

      // Emit COMPLETED audit log for linked ExecutionJob if present. Do NOT
      // mutate ExecutionJob state here; a reconciler/operator should perform
      // the state transition based on audit signals.
      const linkedExec = await prisma.executionJob.findFirst({ where: { payload: { path: ['hydrationJobId'], equals: resolvedHydrationId } } })
      if (linkedExec) {
        await prisma.jobExecutionLog.create({ data: { jobId: String(linkedExec.id), event: 'COMPLETED', prevStatus: linkedExec.status, newStatus: linkedExec.status, meta: { hydrationJobId: resolvedHydrationId, bullJobId: job.id } } }).catch(() => {})
      } else {
        const executionJobId = String(incomingId)
        await prisma.jobExecutionLog.create({ data: { jobId: executionJobId, event: 'COMPLETED', prevStatus: 'running', newStatus: 'running', meta: { bullJobId: job.id } } }).catch(() => {})
      }
    } catch (e) {
      logger?.warn?.('worker.completed: failed to mark executionJob completed or write JobExecutionLog', { err: e })
    }
  })

  return worker
}
