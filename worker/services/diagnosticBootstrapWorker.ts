/**
 * FILE OBJECTIVE:
 * - BullMQ worker that seeds baseline StudentConceptState from a diagnostic (or a
 *   proactive onboarding pre-seed), then -- only for active accounts -- notifies the
 *   parent and generates the initial learning plan.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/diagnosticBootstrapWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-06T00:00:00Z | claude | gate parent notify + plan gen on accountStatus; treat
 *     bootstrap:<id> zero-answer sessions as proactive pre-seed (not partial abandon); add header
 */

import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import { generateLearningPlan } from '@/lib/ai/learningPlan.js'
import { diagnosticConfig } from '@/lib/config';
import { notifyParent, DEFAULT_DASHBOARD_URL } from '@/lib/notifications/parentNotify.js'
import { PARENT_NOTIF_EVENTS } from '@/lib/constants/mail.js'

export interface DiagnosticBootstrapJobData {
  studentId: string
  diagnosticSessionId: string
  chapterIds: string[]
  boardId: string
  gradeId: string
  /** Direct subject ID -- used when questions lack topicId and chapterIds cannot be derived */
  subjectId?: string
}

export async function processDiagnosticBootstrap(job: Job<DiagnosticBootstrapJobData>): Promise<void> {
  const { studentId, diagnosticSessionId, chapterIds } = job.data

  const hasChapters = Array.isArray(chapterIds) && chapterIds.length > 0
  const hasSubjectFallback = typeof job.data.subjectId === 'string' && job.data.subjectId.length > 0

  if (!studentId || !diagnosticSessionId || (!hasChapters && !hasSubjectFallback)) {
    logger.warn('[diagnostic-bootstrap] invalid job data', { jobId: job.id, data: job.data })
    return
  }

  // Gate parent-facing side effects on accountStatus.
  // For under-13 students, accountStatus stays pending_parent_verification until
  // the parent completes OTP. Notifying the parent that the diagnostic / plan
  // is ready *before* they've even verified their email leaks intent and gives
  // the impression the child is fully onboarded. We still run the bootstrap
  // (so state is ready when activation happens) but skip parent notifications
  // and plan generation when the account is not active.
  let accountActive = false
  try {
    const studentForGate = await prisma.user.findUnique({
      where: { id: studentId },
      select: { accountStatus: true },
    })
    accountActive = (studentForGate as { accountStatus?: string } | null)?.accountStatus === 'active'
  } catch (gateErr) {
    // Best-effort gate: any failure (including a partial prisma mock where
    // prisma.user is undefined) degrades safely to "not active", which skips
    // parent-facing side effects rather than crashing the whole job.
    logger.warn('[diagnostic-bootstrap] accountStatus gate lookup failed; treating as inactive', {
      studentId,
      error: String((gateErr as { message?: string } | null)?.message ?? gateErr),
    })
  }

  try {
    let seeded = 0
    let skipped = 0

    // Seed StudentConceptState from diagnostic answers only when chapter data is available.
    // When questions lack topicId (nullable field), chapterIds is empty and seeding is skipped;
    // generateLearningPlan will fall back to default curriculum ordering (mastery = 0 for all).
    if (hasChapters) {
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
      }

      if (concepts.length > 0) {
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
          answerByConcept.set(a.conceptId, a.isCorrect)
        }

        const providedAnswersCount = answerByConcept.size
        const minValid = Number(diagnosticConfig.minAnswersForValidity ?? 10)
        // Distinguish a *proactive* pre-seed (enqueued from onboarding with a
        // synthetic "bootstrap:<userId>" session id and zero answers) from a
        // real diagnostic the student started and abandoned. Both are logged
        // for observability but neither path fabricates mastery for unanswered
        // concepts: only concepts with real evidence (correct/wrong answer)
        // produce a StudentConceptState row. Untouched concepts stay absent,
        // and computeReadinessScore defaults them to 0 -- the honest baseline
        // for "not yet assessed".
        const isProactiveBootstrap =
          providedAnswersCount === 0 && diagnosticSessionId.startsWith('bootstrap:')
        const isPartialAbandon = !isProactiveBootstrap && providedAnswersCount < minValid
        if (isPartialAbandon) {
          logger.info('[diagnostic-bootstrap] partial_abandon_detected', {
            jobId: job.id,
            studentId,
            diagnosticSessionId,
            providedAnswersCount,
            minValid,
          })
        }

        for (const concept of concepts) {
          const answered = answerByConcept.has(concept.id)

          // Honest baseline: no answer -> no mastery row. Previous behaviour
          // seeded 0.3 (default) or 0.5 (partial abandon) for every untouched
          // concept, which surfaced as a misleading 30%/50% chapter mastery on
          // the dashboard even though the student had never attempted those
          // concepts. Skipping the upsert keeps the readiness compute honest.
          if (!answered) {
            skipped += 1
            continue
          }

          const isCorrect = answerByConcept.get(concept.id) === true
          const masteryScore = isCorrect ? 0.6 : 0.15
          const attemptCount = 1

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
                  memoryStrength: Math.round((masteryScore * 1.0) * 1000) / 1000,
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
                  memoryStrength: Math.round((masteryScore * (existing.retention ?? 1)) * 1000) / 1000,
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
          }
        }
      }
    }

    logger.info('[diagnostic-bootstrap] completed', {
      studentId,
      diagnosticSessionId,
      conceptsSeeded: seeded,
      conceptsSkipped: skipped,
      hasChapters,
    })

    // Resolve the subject: prefer the directly-supplied subjectId (from submit route),
    // fall back to deriving from the first chapter when available.
    let primarySubjectId: string | undefined = job.data.subjectId
    let subjectName = 'your subject'

    if (!primarySubjectId && hasChapters) {
      const firstChapter = await prisma.chapterDef.findUnique({
        where: { id: chapterIds[0] },
        select: { subjectId: true, subject: { select: { name: true } } },
      })
      primarySubjectId = firstChapter?.subjectId
      subjectName = firstChapter?.subject?.name ?? 'your subject'
    } else if (primarySubjectId) {
      const subjectDef = await prisma.subjectDef.findUnique({
        where: { id: primarySubjectId },
        select: { name: true },
      })
      subjectName = subjectDef?.name ?? 'your subject'
    }

    if (!accountActive) {
      logger.info('[diagnostic-bootstrap] skipping parent notifications and plan generation -- account not active', {
        studentId,
        diagnosticSessionId,
      })
    } else {
      // Notify parent: diagnostic complete
      notifyParent(studentId, {
        event: PARENT_NOTIF_EVENTS.DIAGNOSTIC_COMPLETE,
        data: {
          subjectName,
          placement: 'See dashboard for details',
          dashboardUrl: DEFAULT_DASHBOARD_URL,
        },
      }).catch((err) =>
        logger.warn('[diagnostic-bootstrap] parent diagnostic_complete notification failed', { studentId, error: String(err) }),
      )

      if (primarySubjectId) {
        const planId = await generateLearningPlan(studentId, primarySubjectId)
        if (planId) {
          const itemCount = await prisma.learningPlanItem.count({ where: { planId } })
          logger.info('[diagnostic-bootstrap] learning plan generated', {
            studentId,
            planId,
            itemCount,
          })

          // Notify parent: learning plan generated
          notifyParent(studentId, {
            event: PARENT_NOTIF_EVENTS.PLAN_GENERATED,
            data: {
              subjectName,
              dashboardUrl: DEFAULT_DASHBOARD_URL,
            },
          }).catch((err) =>
            logger.warn('[diagnostic-bootstrap] parent plan_generated notification failed', { studentId, error: String(err) }),
          )
        }
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

