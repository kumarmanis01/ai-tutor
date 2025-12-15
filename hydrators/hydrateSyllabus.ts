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
import { isSystemSettingEnabled } from "@/lib/systemSettings"
import { contentQueue } from "@/queues/contentQueue"
import { logger } from "@/lib/logger"

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

  // 1️⃣ Global pause guard (type-safe)

  const paused = await prisma.systemSetting.findUnique({ where: { key: "HYDRATION_PAUSED" } })
  if (isSystemSettingEnabled(paused?.value)) {
    return { created: false, reason: "hydration_paused" }
  }

  // 2️⃣ Idempotency: if any active chapter exists for the subject, assume syllabus exists
  const existingChapter = await prisma.chapterDef.findFirst({
    where: { subjectId: input.subjectId, lifecycle: 'active' }
  })
  if (existingChapter) return { created: false, reason: 'syllabus_exists' }

  // 3️⃣ Prevent duplicate queued/running jobs for the same subject/board/grade
  const existingJobWhere: any = {
    jobType: 'syllabus',
    subjectId: input.subjectId,
    grade: input.grade,
    board: input.board,
    status: { in: ['pending', 'running'] }
  }
  const existingJob = await prisma.hydrationJob.findFirst({ where: existingJobWhere })
  if (existingJob) return { created: false, reason: 'job_already_queued', jobId: existingJob.id }

  // 4️⃣ Enqueue job (use string literals to match Prisma schema)
  const jobData: any = {
    jobType: 'syllabus',
    board: input.board,
    grade: input.grade,
    subjectId: input.subjectId,
    language: normalizeLanguage(input.language) ?? 'en',
    difficulty: normalizeDifficulty('medium'),
    status: 'pending'
  }
  const job = await prisma.hydrationJob.create({ data: jobData })

  // Enqueue a worker job to process this hydration row.
  // Job payload is deliberately minimal: worker will re-load the HydrationJob by id.
  try {
    await contentQueue.add(`syllabus-${job.id}`, {
      type: "SYLLABUS",
      payload: { jobId: job.id }
    })
  } catch (err) {
    // If enqueueing fails, keep the DB row but surface failure reason.
    logger.error("Failed to enqueue syllabus hydration job", { error: err, jobId: job.id });
    return { created: false, reason: 'enqueue_failed', jobId: job.id }
  }

  return { created: true, jobId: job.id }
}
