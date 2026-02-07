/**
 * COPILOT RULES — HYDRATOR
 *
 * - Hydrators only enqueue jobs
 * - No AI calls allowed here
 * - Must be idempotent
 * - Must check DB before enqueue
 * - Never mutate existing content
 * example
 * await prisma.hydrationJob.upsert({
 *  where: { jobType_unique },
 *   update: {},
 *   create: {
 *     jobType: "notes",
 *     topicId,
 *     language,
 *   },
 * });
 */

import { normalizeDifficulty, normalizeLanguage } from "@/lib/normalize";
import { prisma } from "@/lib/prisma"
import { JobStatus } from '@/lib/ai-engine/types'
import { isSystemSettingEnabled } from "@/lib/systemSettings"
import { logger } from "@/lib/logger"
import { resolveSubjectId } from "@/lib/resolveAcademicIds"
import { randomUUID } from 'crypto'

const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1'

/**
 * COPILOT RULES — SYLLABUS HYDRATOR
 *
 * - Hydrators ONLY enqueue jobs
 * - NO AI calls allowed
 * - Must be idempotent
 * - Must check DB before enqueue
 * - Must never mutate existing content
 * - Syllabus hydration is SUBJECT-scoped
 */

type HydrationResult =
  | { created: true; jobId: string; bullJobId?: string | number }
  | { created: true; jobId: string; bullJobId?: string | number; outboxId?: string }
  | { created: false; reason: string; jobId?: string }

export async function enqueueSyllabusHydration(input: {
  board: string
  grade: number
  subject: string
  subjectId: string
  language?: string
}): Promise<HydrationResult> {

  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] enqueueSyllabusHydration called', input)

  // 1️⃣ Global pause guard (type-safe)

  const paused = await prisma.systemSetting.findUnique({ where: { key: "HYDRATION_PAUSED" } })
  if (isSystemSettingEnabled(paused?.value)) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: HYDRATION_PAUSED')
    return { created: false, reason: "hydration_paused" }
  }

  // 2️⃣ Resolve subjectId (Phase 2): accept subjectId or subject string and resolve to canonical id
  const resolved = await resolveSubjectId({ board: input.board, grade: input.grade, subject: input.subject, subjectId: input.subjectId })
  if (!resolved.success) {
    const r = (resolved as any).reason ?? 'unknown'
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: resolve failure', { reason: r })
    return { created: false, reason: `resolve_${r}` }
  }

  const subjectId = resolved.subjectId

  // Idempotency: if any active chapter exists for the subject, assume syllabus exists
  const existingChapter = await prisma.chapterDef.findFirst({
    where: { subjectId, lifecycle: 'active' }
  })
  if (existingChapter) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: syllabus_exists')
    return { created: false, reason: 'syllabus_exists' }
  }

  // 3️⃣ Prevent duplicate queued/running jobs for the same subject/board/grade
  const existingJobWhere: any = {
    jobType: 'syllabus',
    subjectId,
    grade: input.grade,
    board: input.board,
    status: { in: [JobStatus.Pending, JobStatus.Running] }
  }
  const existingJob = await prisma.hydrationJob.findFirst({ where: existingJobWhere })
  if (existingJob) {
    if (HYDRATION_DEBUG) logger.info('[hydration][DEBUG] aborted: job_already_queued', { jobId: existingJob.id })
    return { created: false, reason: 'job_already_queued', jobId: existingJob.id }
  }

  // 4️⃣ Enqueue job (use string literals to match Prisma schema).
  // Generate an id and set rootJobId atomically at create time to ensure
  // the DB invariant `rootJobId IS NOT NULL` is preserved.
  const jobId = randomUUID()
  const jobData: any = {
    id: jobId,
    rootJobId: jobId,
    jobType: 'syllabus',
    board: input.board,
    grade: input.grade,
    subjectId,
    language: normalizeLanguage(input.language) ?? 'en',
    difficulty: normalizeDifficulty('medium'),
    status: JobStatus.Pending
  }
  // Create the HydrationJob row in DB regardless of Redis availability so
  // the ExecutionJob -> HydrationJob contract is preserved. If Redis is
  // configured we'll attempt to enqueue a Bull job immediately; otherwise
  // the HydrationJob will exist and can be enqueued later via a requeue.
  const job = await prisma.hydrationJob.create({ data: jobData })
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] created HydrationJob', { jobId: job.id })
  // Create an Outbox row so a separate dispatcher can reliably enqueue the
  // Bull job only after the DB transaction has committed. This avoids races
  // where an in-process enqueue occurs before the ExecutionJob payload is
  // updated or before consumers can observe the HydrationJob row.
  try {
    const outbox = await prisma.outbox.create({ data: { queue: 'content-hydration', payload: { type: 'SYLLABUS', payload: { jobId: job.id } }, meta: { hydrationJobId: job.id } } })
    if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] created Outbox row for HydrationJob', { jobId: job.id, outboxId: outbox.id })
    return { created: true, jobId: job.id, bullJobId: null, outboxId: outbox.id }
  } catch (err) {
    logger.error('Failed to create outbox row for HydrationJob', { error: err, jobId: job.id })
    return { created: true, jobId: job.id }
  }
}
