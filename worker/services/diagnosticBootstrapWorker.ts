import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { buildLearningPlan } from '@/lib/student/learningPlan.js'

export interface DiagnosticBootstrapJobData {
  studentId: string
  diagnosticSessionId: string
  chapterIds: string[]
  boardId: string
  gradeId: string
}

export async function processDiagnosticBootstrap(job: Job<DiagnosticBootstrapJobData>): Promise<void> {
  const { studentId, diagnosticSessionId, chapterIds } = job.data

  if (!studentId || !diagnosticSessionId || !Array.isArray(chapterIds) || chapterIds.length === 0) {
    logger.warn('[diagnostic-bootstrap] invalid job data', { jobId: job.id, data: job.data })
    return
  }

  try {
    const concepts = await prisma.concept.findMany({
      where: {
        topic: {
          chapterId: { in: chapterIds },
        },
      },
      select: {
        id: true,
        irt_b: true,
        bloomLevel: true,
      },
    })

    if (concepts.length === 0) {
      logger.warn('[diagnostic-bootstrap] no concepts found for chapters', {
        jobId: job.id,
        studentId,
        chapterIds,
      })
      return
    }

    const answers = await prisma.answerEvent.findMany({
      where: {
        studentId,
        sessionId: diagnosticSessionId,
      },
      select: {
        conceptId: true,
        isCorrect: true,
      },
    })

    const answerByConcept = new Map<string, boolean>()
    for (const a of answers) {
      if (!a.conceptId) continue
      // If multiple answers exist for a concept, last one wins.
      answerByConcept.set(a.conceptId, a.isCorrect)
    }

    let seeded = 0
    let skipped = 0

    for (const concept of concepts) {
      const answered = answerByConcept.has(concept.id)
      const isCorrect = answered ? answerByConcept.get(concept.id) === true : null

      let masteryScore = 0.3
      let attemptCount = 0

      if (!answered) {
        masteryScore = 0.3
        attemptCount = 0
      } else if (isCorrect) {
        masteryScore = 0.6
        attemptCount = 1
      } else {
        masteryScore = 0.15
        attemptCount = 1
      }

      try {
        const existing = await prisma.studentConceptState.findUnique({
          where: {
            studentId_conceptId: {
              studentId,
              conceptId: concept.id,
            },
          },
        })

        const now = new Date()

        if (!existing) {
          await prisma.studentConceptState.create({
            data: {
              studentId,
              conceptId: concept.id,
              masteryScore,
              lastInteraction: now,
              attemptCount,
            },
          })
          seeded += 1
        } else if (existing.masteryScore < masteryScore) {
          await prisma.studentConceptState.update({
            where: {
              studentId_conceptId: {
                studentId,
                conceptId: concept.id,
              },
            },
            data: {
              masteryScore,
              lastInteraction: now,
              attemptCount: existing.attemptCount + attemptCount,
            },
          })
          seeded += 1
        } else {
          skipped += 1
        }
      } catch (err) {
        logger.error('[diagnostic-bootstrap] failed to upsert StudentConceptState', {
          jobId: job.id,
          studentId,
          conceptId: concept.id,
          error: String((err as any)?.message ?? err),
        })
        // continue with next concept
      }
    }

    logger.info('[diagnostic-bootstrap] completed', {
      studentId,
      diagnosticSessionId,
      conceptsSeeded: seeded,
      conceptsSkipped: skipped,
    })

    const firstChapter = await prisma.chapterDef.findUnique({
      where: { id: chapterIds[0] },
      select: { subjectId: true },
    })
    const primarySubjectId = firstChapter?.subjectId
    if (primarySubjectId) {
      const planResult = await buildLearningPlan(studentId, primarySubjectId)
      if (planResult) {
        logger.info('[diagnostic-bootstrap] learning plan built', {
          studentId,
          planId: planResult.planId,
          itemCount: planResult.itemCount,
        })
      }
    }
  } catch (err) {
    logger.error('[diagnostic-bootstrap] job failed', {
      jobId: job.id,
      studentId,
      diagnosticSessionId,
      error: String((err as any)?.message ?? err),
    })
  }
}

