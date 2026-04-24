import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { updateTheta } from '@/lib/ai/tutor/irt.js'
import type { IRTUpdateJobData } from '@/jobs/irtUpdate'
import { sendPushSafe } from '@/lib/push/send.js'
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications.js'
import { sendParentMilestoneNotification } from '@/lib/notifications/delivery.js'

const MASTERY_THRESHOLD = 0.75

export async function processIRTUpdate(job: Job<IRTUpdateJobData>): Promise<void> {
  const { studentId, conceptId, questionId, sessionId, isCorrect, itemDifficulty, studentAnswer } = job.data

  if (!studentId || !conceptId || !sessionId) {
    logger.warn('[irt-worker] missing required job fields', { jobId: job.id, data: job.data })
    return
  }

  try {
    let current = await prisma.studentConceptState.findUnique({
      where: {
        studentId_conceptId: { studentId, conceptId },
      },
    })

    if (!current) {
      current = await prisma.studentConceptState.create({
        data: {
          studentId,
          conceptId,
          masteryScore: 0.0,
          theta: 0.0,
          masteryVariance: 0.1,
          stability: 1.0,
          retention: 1.0,
          attemptCount: 0,
        },
      })
    }

    const thetaBefore = current.theta
    const b = Number.isFinite(itemDifficulty) ? itemDifficulty : 0
    const result = updateTheta(
      {
        theta: current.theta,
        b,
        a: 1,
        c: 0.2,
      },
      isCorrect,
    )

    const newVariance = Math.max(0.01, current.masteryVariance * 0.9)
    const now = new Date()

    await prisma.studentConceptState.update({
      where: {
        studentId_conceptId: { studentId, conceptId },
      },
      data: {
        theta: result.newTheta,
        masteryScore: result.newMastery,
        masteryVariance: newVariance,
        attemptCount: current.attemptCount + 1,
        lastInteraction: now,
        memoryStrength: Math.round((result.newMastery * (current.retention ?? 1)) * 1000) / 1000,
      },
    })

    const existingAnswer = questionId
      ? await prisma.answerEvent.findFirst({
          where: { sessionId, questionId },
          select: { id: true },
        })
      : null

    if (!existingAnswer && typeof studentAnswer === 'string') {
      await prisma.answerEvent.create({
        data: {
          studentId,
          sessionId,
          conceptId,
          questionId: questionId || null,
          isCorrect,
          studentAnswer: studentAnswer || '',
          source: 'tutor',
        },
      })
    }

    logger.info('[irt-worker] updated', {
      studentId,
      conceptId,
      thetaBefore,
      thetaAfter: result.newTheta,
      masteryAfter: result.newMastery,
    })

    // Check for chapter mastery milestone (best-effort, non-blocking)
    if (result.newMastery >= MASTERY_THRESHOLD && current.masteryScore < MASTERY_THRESHOLD) {
      void checkChapterMastery(studentId, conceptId)
    }
  } catch (err) {
    logger.error('[irt-worker] process failed', {
      jobId: job.id,
      studentId,
      conceptId,
      error: String((err as any)?.message ?? err),
    })
    throw err
  }
}

/**
 * Checks if all concepts in the concept's chapter are now mastered.
 * If so, sends a chapter_mastered push notification once.
 * Uses a Redis key to avoid duplicate notifications.
 */
async function checkChapterMastery(studentId: string, conceptId: string): Promise<void> {
  try {
    // Find the chapter via concept → topic → chapter
    const concept = await prisma.concept.findUnique({
      where: { id: conceptId },
      select: {
        topic: {
          select: {
            chapterId: true,
            chapter: { select: { id: true, name: true } },
          },
        },
      },
    })
    const chapter = concept?.topic?.chapter
    if (!chapter) return

    // All concept IDs in this chapter
    const allConcepts = await prisma.concept.findMany({
      where: { topic: { chapterId: chapter.id } },
      select: { id: true },
    })
    if (allConcepts.length === 0) return

    const conceptIds = allConcepts.map((c: { id: string }) => c.id)

    // How many does this student have mastered?
    const masteredCount = await prisma.studentConceptState.count({
      where: {
        studentId,
        conceptId: { in: conceptIds },
        masteryScore: { gte: MASTERY_THRESHOLD },
      },
    })

    if (masteredCount < conceptIds.length) return

    // Guard: use Redis to prevent duplicate chapter_mastered notifications
    const { getRedis } = await import('@/lib/redis.js')
    const redis = getRedis()
    if (redis) {
      const notifiedKey = `push:chapter_mastered:${studentId}:${chapter.id}`
      const alreadySent = await redis.get(notifiedKey)
      if (alreadySent) return
      await redis.set(notifiedKey, '1', 'EX', 365 * 24 * 60 * 60) // 1 year TTL
    }

    await sendPushSafe(studentId, PUSH_NOTIFICATIONS.chapter_mastered(chapter.name))

    // Notify linked parents about chapter mastery (best-effort)
    try {
      const parents = await prisma.parentStudent.findMany({
        where: { studentId, status: 'active' },
        include: { parent: { select: { id: true, email: true, whatsappPhone: true, name: true, language: true } } },
      })

      if (parents.length > 0) {
        const subject = `${chapter.name} mastered by your child`
        const html = `<p>Hi,</p><p>Your child has mastered the chapter <strong>${chapter.name}</strong>. Great job!</p>`

        const sends = parents.map((p: { parent: { id: string; email?: string | null; whatsappPhone?: string | null; language?: string | null } }) =>
          sendParentMilestoneNotification(p.parent.id, {
            email: p.parent.email ?? undefined,
            whatsappPhone: p.parent.whatsappPhone ?? undefined,
            subject,
            html,
            meta: { studentId, type: 'milestone', locale: p.parent.language },
          }),
        )

        void Promise.allSettled(sends)
      }
    } catch (err) {
      logger.warn('[irt-worker] parent notification failed', { studentId, chapterId: chapter.id, error: String(err) })
    }
  } catch {
    // Best-effort -- never affect the main IRT pipeline
  }
}
