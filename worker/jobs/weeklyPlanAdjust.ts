/**
 * AC-05 (F-STU-003): Weekly learning plan auto-adjust job.
 *
 * Detects students who are behind their plan (have UPCOMING items in weeks
 * earlier than the current week) and regenerates the plan to re-prioritise
 * remaining concepts starting from the current week.
 *
 * Idempotent: calling twice in the same week regenerates the same plan.
 */

import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { generateLearningPlan } from '../../lib/ai/learningPlan.js'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

/**
 * Run the weekly plan adjustment for all active students.
 * Returns the number of plans that were regenerated.
 */
export async function weeklyPlanAdjust(): Promise<{ checked: number; adjusted: number }> {
  const now = new Date()

  const plans = await prisma.learningPlan.findMany({
    select: {
      id: true,
      studentId: true,
      subjectId: true,
      examDate: true,
      weeklyGoal: true,
      generatedAt: true,
    },
  })

  // Pre-compute currentWeek for each plan and filter to those where currentWeek >= 2
  // (plans less than 1 week old cannot yet be behind).
  interface PlanWithWeek {
    id: string
    studentId: string
    subjectId: string
    examDate: Date | null
    weeklyGoal: number
    currentWeek: number
  }
  const eligiblePlans: PlanWithWeek[] = plans
    .map((plan) => ({
      ...plan,
      currentWeek: Math.floor((now.getTime() - plan.generatedAt.getTime()) / MS_PER_WEEK) + 1,
    }))
    .filter((p) => p.currentWeek >= 2)

  // Batch query: count UPCOMING items behind schedule for all eligible plans in a single
  // groupBy query -- eliminates the N+1 pattern of one count() per plan.
  const behindGroups = eligiblePlans.length > 0
    ? await prisma.learningPlanItem.groupBy({
        by: ['planId'],
        where: {
          planId: { in: eligiblePlans.map((p) => p.id) },
          status: 'UPCOMING',
          weekNumber: {
            lt: Math.max(...eligiblePlans.map((p) => p.currentWeek)),
          },
        },
        _count: { _all: true },
      })
    : []

  // Build a per-planId behind-count map so items with weekNumber >= their plan's
  // currentWeek are filtered out below (the groupBy uses the global max as a
  // conservative upper bound; plans where currentWeek is lower are filtered in-loop).
  const behindCountById = new Map<string, number>(
    behindGroups.map((g) => [g.planId, g._count._all]),
  )

  let adjusted = 0
  for (const plan of eligiblePlans) {
    // We used the global max as the upper bound for weekNumber in the batch query.
    // Re-check per plan so plans with a lower currentWeek don't count items from
    // future weeks of other plans as "behind".
    const rawCount = behindCountById.get(plan.id) ?? 0
    // Items with weekNumber >= plan.currentWeek are not yet behind for THIS plan.
    // Because the batch query may have included extra rows (due to global-max upper bound),
    // we perform an exact per-plan count only if the rough count is non-zero.
    let behindCount = rawCount
    if (rawCount > 0) {
      behindCount = await prisma.learningPlanItem.count({
        where: {
          planId: plan.id,
          weekNumber: { lt: plan.currentWeek },
          status: 'UPCOMING',
        },
      })
    }

    if (behindCount === 0) continue

    logger.info('weeklyPlanAdjust: student behind plan', {
      event: 'weekly_plan_adjust_triggered',
      context: { studentId: plan.studentId, subjectId: plan.subjectId, behindCount, currentWeek: plan.currentWeek },
    })

    // generateLearningPlan never throws -- it returns null on failure.
    // Only increment adjusted when regeneration actually succeeded (non-null planId).
    const planId = await generateLearningPlan(plan.studentId, plan.subjectId, {
      examDate: plan.examDate instanceof Date ? plan.examDate : undefined,
      weeklyGoal: plan.weeklyGoal,
    })
    if (planId !== null) {
      adjusted++
    } else {
      logger.warn('weeklyPlanAdjust: generateLearningPlan returned null', {
        event: 'weekly_plan_adjust_failed',
        context: { studentId: plan.studentId, subjectId: plan.subjectId },
      })
    }
  }

  return { checked: plans.length, adjusted }
}
