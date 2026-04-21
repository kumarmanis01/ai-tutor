/**
 * Idempotent helper: enqueue a root syllabus HydrationJob for a subject that
 * has no content yet (no active TopicDef rows).
 *
 * Used by:
 *   - POST /api/student/diagnostic/trigger-generation (DiagnosticWaitingScreen mount)
 *   - POST /api/user/onboarding (proactive background seeding for all selected subjects)
 *
 * Idempotency rules (in order):
 *   1. Topics already exist  → skip (no work needed), return triggered:false, jobId:null
 *   2. Root syllabus job already pending/running → skip, return triggered:false, jobId:<existing>
 *   3. SubjectDef not found  → skip (log warning), return triggered:false, jobId:null
 *   4. Otherwise             → create HydrationJob + Outbox, return triggered:true, jobId:<new>
 *
 * May propagate Prisma/database errors -- callers using fire-and-forget patterns
 * must attach .catch() (or otherwise handle promise rejection) explicitly.
 *
 * See: docs/v2/on-demand-generator.md
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { LanguageCode, DifficultyLevel, JobStatus, JobType } from '@prisma/client';
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants';

export type HydrationEnqueueReason =
  | 'topics_exist'
  | 'job_running'
  | 'subject_not_found'
  | 'created';

export interface HydrationEnqueueResult {
  triggered: boolean;
  jobId: string | null;
  reason: HydrationEnqueueReason;
}

export async function enqueueSubjectHydration(
  subjectId: string,
  language: LanguageCode,
  triggeredBy = 'system',
): Promise<HydrationEnqueueResult> {
  // Rule 1: skip when topics already exist -- pipeline already ran for this subject.
  const topicCount = await prisma.topicDef.count({
    where: {
      chapter: { subjectId, lifecycle: 'active' },
      lifecycle: 'active',
    },
  });
  if (topicCount > 0) {
    return { triggered: false, jobId: null, reason: 'topics_exist' };
  }

  // Rule 2: reuse an existing pending/running root syllabus job.
  // NOTE: there is a TOCTOU window between this check and the create in Rule 4.
  // True idempotency at this level requires a DB-level unique partial index on
  // (subjectId, jobType, hierarchyLevel) for pending/running status. That is a
  // future migration task; the practical impact here is low given the expected
  // low concurrency per subject.
  const existingJob = await prisma.hydrationJob.findFirst({
    where: {
      subjectId,
      jobType: JobType.syllabus,
      hierarchyLevel: 0,
      status: { in: [JobStatus.pending, JobStatus.running] },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  if (existingJob) {
    logger.info('[enqueueSubjectHydration] root syllabus job already in flight', {
      event: 'diagnostic.hydration.already_running',
      context: { subjectId, jobId: existingJob.id, triggeredBy },
    });
    return { triggered: false, jobId: existingJob.id, reason: 'job_running' };
  }

  // Rule 3: guard against a missing SubjectDef (should not happen in normal flow).
  const subjectDef = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      slug: true,
      class: {
        select: {
          grade: true,
          board: { select: { slug: true } },
        },
      },
    },
  });
  if (!subjectDef) {
    logger.warn('[enqueueSubjectHydration] SubjectDef not found -- skipping', {
      event: 'diagnostic.hydration.subject_not_found',
      context: { subjectId, triggeredBy },
    });
    return { triggered: false, jobId: null, reason: 'subject_not_found' };
  }

  const boardSlug = subjectDef.class.board.slug;
  const grade = subjectDef.class.grade;
  const subjectSlug = subjectDef.slug;

  // Rule 4: create HydrationJob + Outbox atomically.
  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.hydrationJob.create({
      data: {
        jobType: JobType.syllabus,
        board: boardSlug,
        grade,
        subject: subjectSlug,
        subjectId: subjectDef.id,
        rootJobId: null,
        parentJobId: null,
        language,
        difficulty: DifficultyLevel.medium,
        status: JobStatus.pending,
        attempts: 0,
        maxAttempts: 3,
        contentReady: false,
        hierarchyLevel: 0,
        inputParams: {
          triggeredBy,
          boardSlug,
          grade,
          subjectSlug,
          subjectId: subjectDef.id,
        },
      },
    });

    await tx.outbox.create({
      data: {
        queue: CONTENT_HYDRATION_QUEUE,
        payload: {
          type: 'SYLLABUS',
          payload: { jobId: created.id },
        },
        meta: {
          hydrationJobId: created.id,
          subjectId: subjectDef.id,
          triggeredBy,
          boardSlug,
          grade,
          subjectSlug,
        },
      },
    });

    return created;
  });

  logger.info('[enqueueSubjectHydration] created root syllabus HydrationJob', {
    event: 'diagnostic.hydration.created',
    context: { subjectId, jobId: job.id, boardSlug, grade, subjectSlug, triggeredBy },
  });

  return { triggered: true, jobId: job.id, reason: 'created' };
}
