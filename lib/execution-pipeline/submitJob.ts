import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { normalizeJobType } from '@/lib/normalize';
import { JobType } from '@prisma/client';
import { JobStatus } from '@/lib/ai-engine/types';

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
  // Audit the creation so admins can see intent in logs
  try {
    await prisma.auditLog.create({ data: { userId: null, action: 'create_job', details: { jobId: job.id, jobType: normalizedJobType, entityType, entityId }, createdAt: new Date() } });
  } catch (err) {
    // non-fatal - log the error
    logger?.warn?.(`Failed to create audit log for job ${job.id}`, { err });
  }

  logger.info(`submitJob: created ExecutionJob ${job.id} (${normalizedJobType})`);

  return { jobId: job.id, existing: false };
}
