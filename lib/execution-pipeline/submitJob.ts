/**
 * FILE OBJECTIVE:
 * - Canonical job submission entrypoint for the AI Content Engine execution pipeline.
 * - Validates jobType/entityType combinations, creates ExecutionJob, and routes to appropriate hydrators.
 *
 * LINKED UNIT TEST:
 * - tests/lib/execution-pipeline/submitJob.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/AI_Execution_pipeline.md
 * - /docs/Hydration_Rules.md
 *
 * EDIT LOG:
 * - 2026-01-22T01:30:00Z | copilot | Phase 1: Added jobType/entityType validation matrix
 * - 2026-01-22T01:50:00Z | copilot | Phase 1 complete: tests passing, documentation updated
 * - 2026-01-22T02:05:00Z | copilot | Phase 2: Generalized routing to all hydrators
 *
 * Orchestrator responsibilities (see docs/WORKER_LIFECYCLE.md):
 * - Only the orchestrator SHOULD create/update `WorkerLifecycle` rows
 * - `submitJob()` is the canonical, idempotent job submission entrypoint and MUST NOT mutate worker lifecycle
 */
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { normalizeJobType, JobType } from '@/lib/normalize';
import { JobStatus } from '@/lib/ai-engine/types';
import { formatLastError, inferFailureCodeFromMessage } from '@/lib/failureCodes';
import { isSystemSettingEnabled } from '@/lib/systemSettings';
import { enqueueSyllabusHydration } from '@/hydrators/hydrateSyllabus';
import {
  enqueueNotesHydration,
  enqueueQuestionsHydration,
  enqueueTestsHydration,
  enqueueAssembleHydration,
} from '@/lib/execution-pipeline/enqueueTopicHydration';

/**
 * Valid jobType → entityType combinations.
 * Per docs/Hydration_Rules.md and docs/AI_Execution_pipeline.md:
 * - syllabus: SUBJECT-scoped (creates chapters/topics for a subject)
 * - notes: TOPIC-scoped (generates notes for a specific topic)
 * - questions: TOPIC-scoped (generates questions for a specific topic)
 * - tests/assemble: TOPIC-scoped (assembles test from questions for a topic)
 */
export const VALID_JOB_ENTITY_COMBINATIONS: Record<string, string[]> = {
  syllabus: ['SUBJECT'],
  notes: ['TOPIC'],
  questions: ['TOPIC'],
  tests: ['TOPIC'],
  assemble: ['TOPIC'],
};

/**
 * Validates that the jobType and entityType combination is architecturally valid.
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function validateJobEntityCombination(
  jobType: string,
  entityType: string
): { valid: true } | { valid: false; reason: string } {
  const validEntityTypes = VALID_JOB_ENTITY_COMBINATIONS[jobType];
  
  if (!validEntityTypes) {
    return { valid: false, reason: `Unknown jobType: ${jobType}` };
  }
  
  if (!validEntityTypes.includes(entityType)) {
    return {
      valid: false,
      reason: `Invalid combination: jobType '${jobType}' requires entityType [${validEntityTypes.join(', ')}], got '${entityType}'`,
    };
  }
  
  return { valid: true };
}

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

  // Admin kill-switches: global and per-job-type disables
  const globalDisabled = await prisma.systemSetting.findUnique({ where: { key: 'HYDRATION_DISABLED' } });
  if (isSystemSettingEnabled(globalDisabled?.value)) {
    throw new Error('HYDRATION_DISABLED');
  }
  const perKey = `HYDRATION_DISABLED_${String(normalizedJobType).toUpperCase()}`;
  const perDisabled = await prisma.systemSetting.findUnique({ where: { key: perKey } });
  if (isSystemSettingEnabled(perDisabled?.value)) {
    throw new Error(`HYDRATION_DISABLED_${String(normalizedJobType).toUpperCase()}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 1: Validate jobType/entityType combination BEFORE any DB lookups
  // Per docs/Hydration_Rules.md: syllabus is SUBJECT-scoped, notes/questions/tests are TOPIC-scoped
  // ──────────────────────────────────────────────────────────────────────────
  const validationResult = validateJobEntityCombination(String(normalizedJobType), entityType);
  if (validationResult.valid === false) {
    logger.warn('submitJob: invalid jobType/entityType combination', {
      jobType: normalizedJobType,
      entityType,
      entityId,
      reason: validationResult.reason,
    });
    throw new Error(validationResult.reason);
  }

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
        // For CHAPTER/TOPIC jobs, extract the parent subject info from entityRow
        // which was already loaded with includes during validation above
        let subjectName = resolvedMeta.entityName;
        let subjectId = '';
        if (entityType === 'SUBJECT') {
          subjectId = entityId;
        } else if (entityType === 'CHAPTER' && entityRow?.subject) {
          subjectId = entityRow.subject.id;
          subjectName = entityRow.subject.name;
        } else if (entityType === 'TOPIC' && entityRow?.chapter?.subject) {
          subjectId = entityRow.chapter.subject.id;
          subjectName = entityRow.chapter.subject.name;
        }
        const hydrateInput = {
          board: resolvedMeta.board,
          grade: resolvedMeta.classLevel,
          subject: subjectName,
          subjectId,
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
            const meta: any = { queue: 'content-hydration', workerType: 'SYLLABUS', hydrationJobId: res.jobId }
            if ((res as any).bullJobId) meta.bullJobId = (res as any).bullJobId
            if ((res as any).outboxId) meta.outboxId = (res as any).outboxId
            await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUED', prevStatus: 'pending', newStatus: 'pending', meta } });
          } catch (e) {
            logger?.warn?.('submitJob: failed to write JobExecutionLog ENQUEUED', { err: e, jobId: job.id });
          }
        } else {
          const reason = (res as any)?.reason ?? 'unknown'
          logger.info('submitJob: enqueueSyllabusHydration aborted', { reason, jobId: job.id, result: res })
          // Record ENQUEUE_FAILED log
          try {
            await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUE_FAILED', prevStatus: 'pending', newStatus: 'pending', message: `hydrator:${reason}` } });
          } catch { /* ignore */ }

          // If the hydrator failed due to missing metadata or resolution issues,
          // mark the ExecutionJob failed so UI does not remain stuck in PENDING.
          if (String(reason).startsWith('resolve_') || reason === 'resolve_not_found' || reason === 'invalid_input') {
            try {
              const code = inferFailureCodeFromMessage(String(reason));
              const le = formatLastError(code, `hydrator:${reason}`);
              await prisma.executionJob.update({ where: { id: job.id }, data: { status: 'failed', lastError: le } })
              await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'FAILED', prevStatus: 'pending', newStatus: 'failed', message: le } }).catch(() => {})
            } catch (e) {
              logger?.warn?.('submitJob: failed to mark ExecutionJob failed after hydrator abort', { err: e, jobId: job.id })
            }
            // Surface error to caller
            throw new Error(`Hydrator aborted: ${reason}`)
          }
        }
      } else {
        // ────────────────────────────────────────────────────────────────────
        // PHASE 2: Route non-syllabus jobs through proper hydrator enqueue functions
        // All TOPIC-scoped jobs (notes, questions, tests, assemble) use the same pattern
        // ────────────────────────────────────────────────────────────────────
        const topicHydrationInput = {
          topicId: entityId, // entityType is TOPIC per Phase 1 validation
          language: payload?.language,
          difficulty: payload?.difficulty,
        };

        let enqueueResult: { created: boolean; jobId?: string; reason?: string; outboxId?: string } | null = null;
        let workerType = '';

        // Route to appropriate hydrator based on jobType
        if (normalizedJobType === JobType.notes) {
          workerType = 'NOTES';
          logger.info('submitJob: invoking enqueueNotesHydration', { jobId: job.id, topicHydrationInput });
          enqueueResult = await enqueueNotesHydration(topicHydrationInput);
        } else if (normalizedJobType === JobType.questions) {
          workerType = 'QUESTIONS';
          logger.info('submitJob: invoking enqueueQuestionsHydration', { jobId: job.id, topicHydrationInput });
          enqueueResult = await enqueueQuestionsHydration(topicHydrationInput);
        } else if (normalizedJobType === JobType.tests) {
          workerType = 'ASSEMBLE_TEST';
          logger.info('submitJob: invoking enqueueTestsHydration', { jobId: job.id, topicHydrationInput });
          enqueueResult = await enqueueTestsHydration(topicHydrationInput);
        } else if (normalizedJobType === JobType.assemble) {
          workerType = 'ASSEMBLE_TEST';
          logger.info('submitJob: invoking enqueueAssembleHydration', { jobId: job.id, topicHydrationInput });
          enqueueResult = await enqueueAssembleHydration(topicHydrationInput);
        } else {
          // Unknown jobType that passed validation - should not happen
          logger.error('submitJob: unhandled jobType after validation', { jobType: normalizedJobType });
          throw new Error(`Unhandled jobType: ${normalizedJobType}`);
        }

        logger.info('submitJob: hydrator returned', { jobId: job.id, workerType, result: enqueueResult });

        if (enqueueResult?.created) {
          // Link ExecutionJob -> HydrationJob by embedding hydrationJobId into payload
          try {
            await prisma.executionJob.update({
              where: { id: job.id },
              data: { payload: { ...(payload || {}), hydrationJobId: enqueueResult.jobId } }
            });
          } catch (e) {
            logger?.warn?.('submitJob: failed to update ExecutionJob payload with hydrationJobId', { err: e, jobId: job.id });
          }
          try {
            const meta: any = { queue: 'content-hydration', workerType, hydrationJobId: enqueueResult.jobId };
            if (enqueueResult.outboxId) meta.outboxId = enqueueResult.outboxId;
            await prisma.jobExecutionLog.create({
              data: { jobId: job.id, event: 'ENQUEUED', prevStatus: 'pending', newStatus: 'pending', meta }
            });
          } catch (e) {
            logger?.warn?.('submitJob: failed to write JobExecutionLog ENQUEUED', { err: e, jobId: job.id });
          }
        } else {
          const reason = enqueueResult?.reason ?? 'unknown';
          logger.info('submitJob: hydrator aborted', { reason, jobId: job.id, workerType, result: enqueueResult });
          // Record ENQUEUE_FAILED log
          try {
            await prisma.jobExecutionLog.create({
              data: { jobId: job.id, event: 'ENQUEUE_FAILED', prevStatus: 'pending', newStatus: 'pending', message: `hydrator:${reason}` }
            });
          } catch { /* ignore */ }

          // If the hydrator failed due to missing metadata or resolution issues,
          // mark the ExecutionJob failed so UI does not remain stuck in PENDING.
          if (String(reason).startsWith('resolve_') || reason === 'resolve_not_found' || reason === 'invalid_input') {
            try {
              const code = inferFailureCodeFromMessage(String(reason));
              const le = formatLastError(code, `hydrator:${reason}`);
              await prisma.executionJob.update({ where: { id: job.id }, data: { status: 'failed', lastError: le } });
              await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'FAILED', prevStatus: 'pending', newStatus: 'failed', message: le } }).catch(() => {});
            } catch (e) {
              logger?.warn?.('submitJob: failed to mark ExecutionJob failed after hydrator abort', { err: e, jobId: job.id });
            }
            // Surface error to caller
            throw new Error(`Hydrator aborted: ${reason}`);
          }
        }
      }
    } catch (err) {
      logger.error('submitJob: failed to enqueue', { err, jobId: job.id });
      try {
        await prisma.jobExecutionLog.create({ data: { jobId: job.id, event: 'ENQUEUE_FAILED', prevStatus: 'pending', newStatus: 'pending', message: String(err) } });
      } catch (e) {
        logger?.warn?.('submitJob: failed to write JobExecutionLog ENQUEUE_FAILED', { err: e, jobId: job.id });
      }
      // Re-throw so caller knows the job submission failed
      throw err;
    }

    // NOTE: Orchestrator is responsible for creating WorkerLifecycle rows.
    // submitJob MUST NOT create or mutate WorkerLifecycle entries — this keeps
    // job submission and worker orchestration responsibilities separated.
  return { jobId: job.id, existing: false };
}
