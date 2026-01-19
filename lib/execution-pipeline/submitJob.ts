/**
 * Orchestrator responsibilities (see docs/WORKER_LIFECYCLE.md):
 * - Only the orchestrator SHOULD create/update `WorkerLifecycle` rows
 * - `submitJob()` is the canonical, idempotent job submission entrypoint and MUST NOT mutate worker lifecycle
 */
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { normalizeJobType } from '@/lib/normalize';
import { JobType } from '@prisma/client';
import { JobStatus } from '@/lib/ai-engine/types';
import { getContentQueue } from '@/queues/contentQueue';
import { enqueueSyllabusHydration } from '@/hydrators/hydrateSyllabus';

export type SubmitJobInput = {
  jobType: unknown; // validated by callers; cast to Prisma enum at write-time
  entityType: string;
  entityId: string;
  payload?: any;
  maxAttempts?: number;
};

export async function submitJob(input: SubmitJobInput) {
  const { jobType, entityType, entityId, payload = {}, maxAttempts = 5 } = input;

  // Normalize jobType via central utility so all callers use consistent mapping
  const normalizedJobType = normalizeJobType(String(jobType));
  logger.debug(`submitJob: received jobType=${String(jobType)}, normalized=${normalizedJobType}`);
  logger.info(`submitJob: enqueue request`, { jobType: normalizedJobType, entityType, entityId, payload });

  // Basic validation: ensure ID exists for the referenced entity and capture readable metadata for logging
  let entityRow: any = null;
  const resolvedMeta: any = { board: null, classLevel: null, entityName: null };
  switch (entityType) {
    case 'BOARD':
      entityRow = await prisma.board.findUnique({ where: { id: entityId } });
      if (entityRow) resolvedMeta.entityName = entityRow.name;
      break;
    case 'CLASS':
      entityRow = await prisma.classLevel.findUnique({ where: { id: entityId }, include: { board: true } });
      if (entityRow) {
        resolvedMeta.entityName = `Class ${entityRow.grade}`;
        resolvedMeta.classLevel = entityRow.grade;
        resolvedMeta.board = entityRow.board?.name ?? null;
      }
      break;
    case 'SUBJECT':
      entityRow = await prisma.subjectDef.findUnique({ where: { id: entityId }, include: { class: { include: { board: true } } } });
      if (entityRow) {
        resolvedMeta.entityName = entityRow.name;
        resolvedMeta.classLevel = entityRow.class?.grade ?? null;
        resolvedMeta.board = entityRow.class?.board?.name ?? null;
      }
      break;
    case 'CHAPTER':
      entityRow = await prisma.chapterDef.findUnique({ where: { id: entityId }, include: { subject: { include: { class: { include: { board: true } } } } } });
      if (entityRow) {
        resolvedMeta.entityName = entityRow.name;
        resolvedMeta.classLevel = entityRow.subject?.class?.grade ?? null;
        resolvedMeta.board = entityRow.subject?.class?.board?.name ?? null;
      }
      break;
    case 'TOPIC':
      entityRow = await prisma.topicDef.findUnique({ where: { id: entityId }, include: { chapter: { include: { subject: { include: { class: { include: { board: true } } } } } } } });
      if (entityRow) {
        resolvedMeta.entityName = entityRow.name;
        resolvedMeta.classLevel = entityRow.chapter?.subject?.class?.grade ?? null;
        resolvedMeta.board = entityRow.chapter?.subject?.class?.board?.name ?? null;
      }
      break;
    default:
      throw new Error(`Unsupported entityType: ${entityType}`);
  }

  if (!entityRow) {
    throw new Error(`Entity not found: ${entityType} ${entityId}`);
  }

  // Attach any provided language into meta for logs
  if (payload?.language) resolvedMeta.language = payload.language;
  logger.debug(`submitJob: resolved entity meta`, { resolvedMeta });

  // Validate required metadata for certain job types
  const requiresLanguage = ['syllabus', 'notes', 'questions', 'tests'].includes(String(normalizedJobType));
  if (requiresLanguage && !payload?.language) {
    logger.warn('submitJob: missing required language for content job', { jobType: normalizedJobType, entityType, entityId });
    throw new Error('Missing required language in payload');
  }

  // For syllabus jobs, ensure we have academic context (board + class)
  if (normalizedJobType === JobType.syllabus) {
    if (!resolvedMeta.classLevel || !resolvedMeta.board) {
      logger.warn('submitJob: insufficient academic context for syllabus job', { entityType, entityId, resolvedMeta });
      throw new Error('Insufficient academic context: syllabus jobs require class and board');
    }
  }

  // Idempotency: return existing pending/running job if present
  const existing = await prisma.executionJob.findFirst({
    where: {
      jobType: normalizedJobType as any,
      entityType,
      entityId,
      status: { in: [JobStatus.Pending, JobStatus.Running] },
    },
  });

  if (existing) {
    logger.info(`submitJob: idempotent hit returning existing job`, { jobId: existing.id, status: existing.status, attempts: existing.attempts, entityType, entityId });
    return { jobId: existing.id, existing: true };
  }

  const job = await prisma.executionJob.create({
    data: {
      jobType: normalizedJobType as any,
      entityType,
      entityId,
      payload,
      status: JobStatus.Pending,
      maxAttempts,
    },
  });
  // Emit JobExecutionLog: CREATED
  try {
    await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'CREATED', prevStatus: null, newStatus: 'pending', meta: { resolvedMeta: resolvedMeta } } });
  } catch (e) {
    logger?.warn?.('submitJob: failed to write JobExecutionLog CREATED', { err: e, jobId: job.id });
  }
  // Audit the creation so admins can see intent in logs
  try {
    await prisma.auditLog.create({ data: { userId: null, action: 'create_job', details: { jobId: job.id, jobType: normalizedJobType, entityType, entityId }, createdAt: new Date() } });
  } catch (err) {
    // non-fatal - log the error
    logger?.warn?.(`Failed to create audit log for job ${job.id}`, { err });
  }

  logger.info(`submitJob: created ExecutionJob ${job.id} (${normalizedJobType})`);

    // Enqueue behavior:
    // - For syllabus jobs always invoke canonical hydrator which creates a
    //   HydrationJob row and attempts to enqueue a Bull job when Redis is
    //   available. This ensures the HydrationJob exists even when the web
    //   process cannot reach Redis (requeue can handle later).
    // - For other job types, enqueue only if Redis is configured.
    try {
      if (normalizedJobType === JobType.syllabus) {
        const hydrateInput = {
          board: resolvedMeta.board,
          grade: resolvedMeta.classLevel,
          subject: resolvedMeta.entityName,
          subjectId: entityType === 'SUBJECT' ? entityId : '',
          language: payload?.language,
        }
        // Diagnostic log: record resolved meta and hydrate input so we can
        // trace why HydrationJobs may not be created in production.
        try {
          logger.info('submitJob: invoking enqueueSyllabusHydration', { jobId: job.id, resolvedMeta, hydrateInput, payload });
        } catch {}
        const res = await enqueueSyllabusHydration(hydrateInput as any)
        try {
          logger.info('submitJob: enqueueSyllabusHydration returned', { jobId: job.id, result: res });
        } catch {}
        if (res.created) {
          // Link ExecutionJob -> HydrationJob by embedding hydrationJobId into payload
          try {
            await prisma.executionJob.update({ where: { id: job.id }, data: { payload: { ...(payload || {}), hydrationJobId: res.jobId } } })
          } catch (e) {
            logger?.warn?.('submitJob: failed to update ExecutionJob payload with hydrationJobId', { err: e, jobId: job.id })
          }
          try {
            await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUED', prevStatus: 'pending', newStatus: 'pending', meta: { queue: 'content-hydration', workerType: 'SYLLABUS', bullJobId: (res as any).bullJobId ?? null, hydrationJobId: res.jobId } } });
          } catch (e) {
            logger?.warn?.('submitJob: failed to write JobExecutionLog ENQUEUED', { err: e, jobId: job.id });
          }
        } else {
          const reason = (res as any)?.reason ?? 'unknown'
          logger.info('submitJob: enqueueSyllabusHydration aborted', { reason, jobId: job.id, result: res })
          try {
            await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUE_FAILED', prevStatus: 'pending', newStatus: 'pending', message: `hydrator:${reason}` } });
          } catch { /* ignore */ }
        }
      } else {
        if (process.env.REDIS_URL) {
          const q = getContentQueue();
          // Map prisma JobType -> worker type string
          const mapping: Record<string, string> = {
            syllabus: 'SYLLABUS',
            notes: 'NOTES',
            questions: 'QUESTIONS',
            tests: 'ASSEMBLE_TEST',
            assemble: 'ASSEMBLE_TEST',
          };
          const workerType = mapping[String(normalizedJobType)] || String(normalizedJobType).toUpperCase();
          const bullJob = await q.add(`${workerType.toLowerCase()}-${job.id}`, { type: workerType, payload: { jobId: job.id, ...payload } });
          logger.info('submitJob: enqueued to Redis queue', { queue: 'content-hydration', jobId: job.id, workerType, bullJobId: bullJob?.id });
          try {
            await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUED', prevStatus: 'pending', newStatus: 'pending', meta: { queue: 'content-hydration', workerType, bullJobId: bullJob?.id } } });
          } catch (e) {
            logger?.warn?.('submitJob: failed to write JobExecutionLog ENQUEUED', { err: e, jobId: job.id });
          }
        } else {
          logger.info('submitJob: REDIS not configured; skipping enqueue for non-syllabus job', { jobId: job.id })
        }
      }
    } catch (err) {
      logger.error('submitJob: failed to enqueue to Redis', { err, jobId: job.id });
      try {
        await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUE_FAILED', prevStatus: 'pending', newStatus: 'pending', message: String(err) } });
      } catch (e) {
        logger?.warn?.('submitJob: failed to write JobExecutionLog ENQUEUE_FAILED', { err: e, jobId: job.id });
      }
    }

    // NOTE: Orchestrator is responsible for creating WorkerLifecycle rows.
    // submitJob MUST NOT create or mutate WorkerLifecycle entries — this keeps
    // job submission and worker orchestration responsibilities separated.
  return { jobId: job.id, existing: false };
}
