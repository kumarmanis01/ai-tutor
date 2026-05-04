/**
 * Idempotent helper: enqueue a root syllabus HydrationJob for a subject that
 * has no content yet (no active TopicDef rows).
 *
 * Used by:
 *   - POST /api/student/diagnostic/trigger-generation (DiagnosticWaitingScreen mount)
 *   - POST /api/user/onboarding (proactive background seeding for all selected subjects)
 *
 * Idempotency rules (in order, all within a single Postgres transaction):
 *   1. Topics already exist  → skip (no work needed), return triggered:false, jobId:null
 *   2. Root syllabus job already pending/running → skip, return triggered:false, jobId:<existing>
 *   3. SubjectDef not found  → skip (log warning), return triggered:false, jobId:null
 *   4. Otherwise             → create HydrationJob + Outbox, return triggered:true, jobId:<new>
 *
 * Rules 2-4 run inside a single Postgres transaction guarded by a per-subject
 * advisory lock (pg_advisory_xact_lock) so concurrent callers for the same
 * subject serialise at the DB level rather than racing through the check+create.
 *
 * May propagate Prisma/database errors -- callers using fire-and-forget patterns
 * must attach .catch() (or otherwise handle promise rejection) explicitly.
 *
 * See: docs/v2/on-demand-generator.md
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { LanguageCode } from '@prisma/client';
import { JobStatus } from '@/lib/ai-engine/types';
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

/**
 * Deterministic, non-negative PostgreSQL bigint lock key for a subjectId string.
 * Uses a polynomial hash clamped to [0, 2^63-1] so it fits in a Postgres bigint.
 */
function subjectAdvisoryLockKey(subjectId: string): bigint {
  let h = 0n;
  for (const c of subjectId) {
    h = (h * 31n + BigInt(c.charCodeAt(0))) & 0x7fffffffffffffffn;
  }
  return h;
}

type _TxOutcome =
  | { outcome: 'job_running'; jobId: string }
  | { outcome: 'subject_not_found' }
  | { outcome: 'created'; jobId: string; boardSlug: string; grade: number; subjectSlug: string };

export async function enqueueSubjectHydration(
  subjectId: string,
  language: LanguageCode,
  triggeredBy = 'system',
): Promise<HydrationEnqueueResult> {
  // Rule 1: fast path -- skip when topics already exist (no transaction needed).
  const topicCount = await prisma.topicDef.count({
    where: {
      chapter: { subjectId, lifecycle: 'active' },
      lifecycle: 'active',
    },
  });
  if (topicCount > 0) {
    return { triggered: false, jobId: null, reason: 'topics_exist' };
  }

  // Rules 2-4 run inside a single transaction protected by a per-subject advisory
  // lock. pg_advisory_xact_lock blocks concurrent callers for the same subjectId
  // until the first caller commits, eliminating the TOCTOU race between the
  // "no in-flight job" check and the HydrationJob create.
  const lockKey = subjectAdvisoryLockKey(subjectId);

  const txResult = await prisma.$transaction(async (tx) => {
    // Acquire the advisory lock. Concurrent calls for the same subjectId wait here;
    // the lock is released automatically when the transaction ends.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

    // Rule 2: reuse an existing pending/running root syllabus job.
    const inFlight = await tx.hydrationJob.findFirst({
      where: {
        subjectId,
        jobType: 'syllabus',
        hierarchyLevel: 0,
        status: { in: [JobStatus.Pending, JobStatus.Running] },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (inFlight) {
      return { outcome: 'job_running' as const, jobId: inFlight.id };
    }

    // Rule 3: guard against a missing SubjectDef (should not happen in normal flow).
    const subjectDef = await tx.subjectDef.findUnique({
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
      return { outcome: 'subject_not_found' as const };
    }

    const boardSlug = subjectDef.class.board.slug;
    const grade = subjectDef.class.grade;
    const subjectSlug = subjectDef.slug;

    // Rule 4: create HydrationJob + Outbox atomically.
    const created = await tx.hydrationJob.create({
      data: {
        jobType: 'syllabus',
        board: boardSlug,
        grade,
        subject: subjectSlug,
        subjectId: subjectDef.id,
        rootJobId: null,
        parentJobId: null,
        language,
        difficulty: 'medium',
        status: JobStatus.Pending,
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

    return { outcome: 'created' as const, jobId: created.id, boardSlug, grade, subjectSlug };
  });

  if (txResult.outcome === 'job_running') {
    logger.info('[enqueueSubjectHydration] root syllabus job already in flight', {
      event: 'diagnostic.hydration.already_running',
      context: { subjectId, jobId: txResult.jobId, triggeredBy },
    });
    return { triggered: false, jobId: txResult.jobId, reason: 'job_running' };
  }

  if (txResult.outcome === 'subject_not_found') {
    logger.warn('[enqueueSubjectHydration] SubjectDef not found -- skipping', {
      event: 'diagnostic.hydration.subject_not_found',
      context: { subjectId, triggeredBy },
    });
    return { triggered: false, jobId: null, reason: 'subject_not_found' };
  }

  logger.info('[enqueueSubjectHydration] created root syllabus HydrationJob', {
    event: 'diagnostic.hydration.created',
    context: {
      subjectId,
      jobId: txResult.jobId,
      boardSlug: txResult.boardSlug,
      grade: txResult.grade,
      subjectSlug: txResult.subjectSlug,
      triggeredBy,
    },
  });
  return { triggered: true, jobId: txResult.jobId, reason: 'created' };
}
