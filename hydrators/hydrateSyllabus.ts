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
import { getContentQueue } from "@/queues/contentQueue"
import { logger } from "@/lib/logger"
import { resolveSubjectId } from "@/lib/resolveAcademicIds"

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
  | { created: true; jobId: string }
  | { created: false; reason: string; jobId?: string }

export async function enqueueSyllabusHydration(input: {
  board: string
  grade: number
  subject: string
  subjectId: string
  language?: string
}): Promise<HydrationResult> {

  if (HYDRATION_DEBUG) console.log('[hydration][DEBUG] enqueueSyllabusHydration called', input)

  // 1️⃣ Global pause guard (type-safe)

  const paused = await prisma.systemSetting.findUnique({ where: { key: "HYDRATION_PAUSED" } })
  if (isSystemSettingEnabled(paused?.value)) {
    if (HYDRATION_DEBUG) console.log('[hydration][DEBUG] aborted: HYDRATION_PAUSED')
    return { created: false, reason: "hydration_paused" }
  }

  // 2️⃣ Resolve subjectId (Phase 2): accept subjectId or subject string and resolve to canonical id
  const resolved = await resolveSubjectId({ board: input.board, grade: input.grade, subject: input.subject, subjectId: input.subjectId })
  if (!resolved.success) {
    const r = (resolved as any).reason ?? 'unknown'
    if (HYDRATION_DEBUG) console.log('[hydration][DEBUG] aborted: resolve failure', r)
    return { created: false, reason: `resolve_${r}` }
  }

  const subjectId = resolved.subjectId

  // Idempotency: if any active chapter exists for the subject, assume syllabus exists
  const existingChapter = await prisma.chapterDef.findFirst({
    where: { subjectId, lifecycle: 'active' }
  })
  if (existingChapter) {
    if (HYDRATION_DEBUG) console.log('[hydration][DEBUG] aborted: syllabus_exists')
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
    if (HYDRATION_DEBUG) console.log('[hydration][DEBUG] aborted: job_already_queued', { jobId: existingJob.id })
    return { created: false, reason: 'job_already_queued', jobId: existingJob.id }
  }

  // 4️⃣ Enqueue job (use string literals to match Prisma schema)
  const jobData: any = {
    jobType: 'syllabus',
    board: input.board,
    grade: input.grade,
    subjectId,
    language: normalizeLanguage(input.language) ?? 'en',
    difficulty: normalizeDifficulty('medium'),
    status: JobStatus.Pending
  }
  // If Redis is not configured, avoid creating a DB job we can't enqueue.
  if (!process.env.REDIS_URL) {
    logger.error('Redis not configured; cannot enqueue hydration job', { board: input.board, grade: input.grade, subjectId: input.subjectId })
    if (HYDRATION_DEBUG) console.log('[hydration][DEBUG] aborted: redis_not_configured')
    return { created: false, reason: 'redis_not_configured' }
  }

  const job = await prisma.hydrationJob.create({ data: jobData })
  if (HYDRATION_DEBUG) console.log('[hydration][DEBUG] created HydrationJob', { jobId: job.id })

  // Enqueue a worker job to process this hydration row.
  // Job payload is deliberately minimal: worker will re-load the HydrationJob by id.
  try {
    const q = getContentQueue();
    await q.add(`syllabus-${job.id}`, {
      type: "SYLLABUS",
      payload: { jobId: job.id }
    })
    if (HYDRATION_DEBUG) console.log('[hydration][DEBUG] enqueued Bull job for HydrationJob', { jobId: job.id })
  } catch (err) {
    // If enqueueing fails, keep the DB row but surface failure reason.
    logger.error("Failed to enqueue syllabus hydration job", { error: err, jobId: job.id });
    return { created: false, reason: 'enqueue_failed', jobId: job.id }
  }

  return { created: true, jobId: job.id }
}
