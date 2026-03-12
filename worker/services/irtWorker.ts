import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { updateTheta } from '@/lib/ai/tutor/irt.js'
import type { IRTUpdateJobData } from '@/jobs/irtUpdate'

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
