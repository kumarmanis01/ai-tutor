import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { updateSM18 } from '@/lib/ai/tutor/sm18.js'
import { getRedis } from '@/lib/redis.js'
import { sendPushSafe } from '@/lib/push/send.js'
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications.js'

const BATCH_SIZE = 100
const MS_PER_DAY = 86400000
/** AC-07 (F-STU-022): use higher targetRetention when exam <= this many days away. */
const PRE_EXAM_DAYS = 14
const PRE_EXAM_TARGET_RETENTION = 0.92
/** Redis key TTL for pre-exam notification rate-limit (30 days). */
const PRE_EXAM_NOTIFY_TTL_SECONDS = 30 * 24 * 60 * 60

/**
 * AC-07 (F-STU-022): Notify students whose exam is within 14 days that
 * pre-exam revision mode has been activated.
 * Uses a Redis key per (studentId, yearMonth) to send at most once per month.
 * Best-effort -- never throws.
 */
async function notifyPreExamStudents(
  upcomingExams: Array<{ studentId: string; subjectId: string; subjectName?: string | null }>,
): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const yearMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  for (const exam of upcomingExams) {
    try {
      const key = `pre-exam:notified:${exam.studentId}:${yearMonth}`
      const already = await redis.get(key)
      if (already) continue
      const subjectName = exam.subjectName ?? 'your subject'
      void sendPushSafe(
        exam.studentId,
        PUSH_NOTIFICATIONS.exam_14_days(subjectName, 0), // readiness filled as 0 -- notification text shows urgency regardless
      )
      await redis.set(key, '1', 'EX', PRE_EXAM_NOTIFY_TTL_SECONDS)
      logger.info('[sm18-worker] pre-exam notification sent', {
        event: 'pre_exam_mode_activated',
        context: { studentId: exam.studentId, subjectId: exam.subjectId },
      })
    } catch (err) {
      // never let notification errors break the worker
      logger.warn('[sm18-worker] pre-exam notification failed', {
        studentId: exam.studentId,
        error: String((err as any)?.message ?? err),
      })
    }
  }
}

export async function processNightlySM18(_job?: Job): Promise<void> {
  const now = new Date()
  let totalProcessed = 0
  let totalUpdated = 0
  let totalErrors = 0

  // AC-07: pre-load upcoming exams indexed by studentId for O(1) lookup per row
  const preExamCutoff = new Date(now.getTime() + PRE_EXAM_DAYS * MS_PER_DAY)
  const upcomingExams = await prisma.learningPlan.findMany({
    where: { examDate: { gte: now, lte: preExamCutoff } },
    select: { studentId: true, subjectId: true },
  })
  const preExamStudentIds = new Set(upcomingExams.map((p) => p.studentId))

  // Look up subject names for the notifications (best-effort -- no subject = no name)
  const subjectIds = [...new Set(upcomingExams.map((e) => e.subjectId))]
  const subjectDefs = subjectIds.length
    ? await prisma.subjectDef.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true },
      })
    : []
  const subjectNameById = new Map(subjectDefs.map((s) => [s.id, s.name]))

  // AC-07: notify students entering pre-exam mode (fire-and-forget, never throws)
  void notifyPreExamStudents(
    upcomingExams.map((e) => ({
      studentId: e.studentId,
      subjectId: e.subjectId,
      subjectName: subjectNameById.get(e.subjectId) ?? null,
    })),
  )

  try {
    for (;;) {
      const batch = await prisma.studentConceptState.findMany({
        where: {
          OR: [
            { nextReviewAt: { lte: now } },
            { nextReviewAt: null },
          ],
        },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
      })

      if (batch.length === 0) break

      for (const row of batch) {
        totalProcessed += 1
        try {
          const elapsedMs = now.getTime() - row.lastInteraction.getTime()
          const elapsedDays = elapsedMs / MS_PER_DAY

          // AC-07: shorten intervals for students with exams within 14 days
          const isPreExam = preExamStudentIds.has(row.studentId)

          const result = updateSM18({
            stability: row.stability,
            retention: row.retention,
            isCorrect: true,
            elapsedDays,
            targetRetention: isPreExam ? PRE_EXAM_TARGET_RETENTION : undefined,
          })

          const nextReviewAt = new Date(now.getTime() + result.nextReviewInDays * MS_PER_DAY)

          await prisma.studentConceptState.update({
            where: { id: row.id },
            data: {
              stability: result.newStability,
              retention: result.newRetention,
              nextReviewAt,
              memoryStrength: Math.round((result.newRetention * (row.masteryScore ?? 0)) * 1000) / 1000,
            },
          })
          totalUpdated += 1
        } catch (err) {
          totalErrors += 1
          logger.warn('[sm18-worker] row update failed', {
            id: row.id,
            studentId: row.studentId,
            conceptId: row.conceptId,
            error: String((err as any)?.message ?? err),
          })
        }
      }
    }

    logger.info('[sm18-worker] batch summary', {
      processed: totalProcessed,
      updated: totalUpdated,
      errors: totalErrors,
    })
  } catch (err) {
    logger.error('[sm18-worker] nightly run failed', {
      error: String((err as any)?.message ?? err),
    })
    throw err
  }
}
