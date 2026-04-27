import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma.js'
import { logger } from '@/lib/logger.js'
import type { ReteachPlanJobData } from '@/jobs/reteachPlan'

/**
 * Inserts (or skips duplicate) UPCOMING LearningPlanItem for re-teach.
 *
 * Deduplication: if an UPCOMING item for this (student, concept) already
 * exists in any plan, we skip insertion to avoid flooding the plan.
 *
 * Placement: appended to week 1 of the student's first active plan for any
 * subject containing the concept.  Falls back to creating a placeholder plan
 * if none exists.
 */
export async function processReteachPlan(job: Job<ReteachPlanJobData>): Promise<void> {
  const { studentId, conceptId } = job.data

  if (!studentId || !conceptId) {
    logger.warn('[reteach-plan-worker] missing required fields', { jobId: job.id, data: job.data })
    return
  }

  try {
    // 1. Get concept → subjectId
    const concept = await prisma.concept.findUnique({
      where: { id: conceptId },
      select: { subjectId: true },
    })
    if (!concept) {
      logger.warn('[reteach-plan-worker] concept not found', { conceptId })
      return
    }

    // 2. Deduplicate: skip if UPCOMING item already exists for this concept
    const existing = await prisma.learningPlanItem.findFirst({
      where: {
        conceptId,
        status: 'UPCOMING',
        plan: { studentId },
      },
    })
    if (existing) {
      logger.info('[reteach-plan-worker] item already exists, skipping', { studentId, conceptId })
      return
    }

    // 3. Find the student's active learning plan for this subject
    let plan = await prisma.learningPlan.findFirst({
      where: { studentId, subjectId: concept.subjectId },
      include: {
        items: {
          where: { weekNumber: 1 },
          orderBy: { orderInWeek: 'desc' },
          take: 1,
        },
      },
    })

    // 4. If no plan, create a minimal one (ensures item can be inserted)
    if (!plan) {
      plan = await prisma.learningPlan.create({
        data: { studentId, subjectId: concept.subjectId },
        include: { items: { where: { weekNumber: 1 }, orderBy: { orderInWeek: 'desc' }, take: 1 } },
      })
    }

    const maxOrder = plan.items[0]?.orderInWeek ?? -1

    // 5. Insert the re-teach item at the end of week 1
    await prisma.learningPlanItem.create({
      data: {
        planId: plan.id,
        conceptId,
        weekNumber: 1,
        orderInWeek: maxOrder + 1,
        status: 'UPCOMING',
      },
    })

    logger.info('[reteach-plan-worker] re-teach item inserted', {
      event: 'reteach_plan_item_inserted',
      context: { studentId, conceptId, planId: plan.id },
    })
  } catch (err) {
    logger.error('[reteach-plan-worker] failed', {
      studentId,
      conceptId,
      error: String((err as any)?.message ?? err),
    })
    throw err // Let BullMQ retry
  }
}
