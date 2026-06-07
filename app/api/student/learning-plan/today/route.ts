/**
 * FILE OBJECTIVE:
 * - GET /api/student/learning-plan/today
 * - Returns the next upcoming learning-plan item for the student's current week
 *   and falls back to next-action guidance when no plan exists.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/learning-plan/today/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-04T00:00:00Z | staff-engineer | add stale-plan background regeneration trigger
 * - 2026-05-04T00:00:00Z | copilot | add required file header and guarded regeneration dedup lock
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getNextAction } from '@/lib/homeEngine/getNextAction'
import { enqueueLearningPlanRegeneration } from '@/lib/ai/learningPlanRegeneration'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Plans older than this are considered stale and queued for background regeneration.
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * GET /api/student/learning-plan/today
 *
 * Returns the next LearningPlanItem for today based on the student's current
 * week number. Falls back to getNextAction if no plan exists.
 *
 * Response shape (Domain 7 §7.5):
 *   { item: LearningPlanItem | null, fallback: boolean }
 */
export async function GET(req: Request) {
  const start = Date.now()
  const session = await getServerSessionForHandlers()
  const userId = (session?.user as { id?: string })?.id
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    logger.logAPI(req, res, { className: 'LearningPlanTodayAPI', methodName: 'GET' }, start)
    return res
  }

  try {
    // 1. Find the most recently generated plan for this student
    const plan = await prisma.learningPlan.findFirst({
      where: { studentId: userId },
      orderBy: { generatedAt: 'desc' },
      select: { id: true, subjectId: true, weeklyGoal: true, examDate: true, generatedAt: true },
    })

    if (!plan) {
      // No plan exists -- fall back to next action engine. Log failures
      // instead of swallowing so a degraded fallback is observable.
      const nextAction = await getNextAction(userId).catch((err) => {
        logger.warn('[learning-plan/today] getNextAction fallback failed', {
          event: 'learning_plan_today_fallback_failed',
          context: { userId },
          error: String((err as Error)?.message ?? err),
        })
        return null
      })
      const action =
        nextAction && typeof nextAction === 'object' && 'action' in nextAction
          ? (nextAction as { action: unknown }).action
          : nextAction
      const res = NextResponse.json({ item: null, fallback: true, action }, { status: 200 })
      logger.logAPI(req, res, { className: 'LearningPlanTodayAPI', methodName: 'GET' }, start)
      return res
    }

    // 2. Determine current week number from first session date
    const firstSession = await prisma.structuredSession.findFirst({
      where: { studentId: userId },
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true },
    })

    const daysSinceFirst = firstSession
      ? Math.floor((Date.now() - firstSession.startedAt.getTime()) / 86_400_000)
      : 0
    const currentWeek = Math.max(1, Math.ceil((daysSinceFirst + 1) / 7))

    // 3. Find the first UPCOMING item for current week (or any earlier week if behind)
    const item = await prisma.learningPlanItem.findFirst({
      where: {
        planId: plan.id,
        status: 'UPCOMING',
        weekNumber: { lte: currentWeek },
      },
      orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
      select: {
        id: true,
        planId: true,
        conceptId: true,
        weekNumber: true,
        orderInWeek: true,
        status: true,
        deferredAt: true,
        completedAt: true,
        concept: {
          select: {
            name: true,
            subjectId: true,
            topic: {
              select: {
                name: true,
                chapter: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    // AC-05 (F-STU-003): trigger a non-blocking plan regeneration when the plan is stale
    // (older than 7 days). This surfaces fresh mastery data so the plan re-prioritises
    // remaining chapters based on what the student has actually learned since last generation.
    if (plan.generatedAt && Date.now() - plan.generatedAt.getTime() > STALE_THRESHOLD_MS) {
      await enqueueLearningPlanRegeneration({
        studentId: userId,
        subjectId: plan.subjectId,
        examDate: plan.examDate ?? undefined,
        weeklyGoal: plan.weeklyGoal,
        routeName: 'LearningPlanTodayAPI',
        methodName: 'GET',
      })
    }

    const res = NextResponse.json({ item, fallback: false }, { status: 200 })
    logger.logAPI(req, res, { className: 'LearningPlanTodayAPI', methodName: 'GET' }, start)
    return res
  } catch (err) {
    logger.error('[learning-plan/today] error', {
      userId,
      error: String((err as any)?.message ?? err),
    })
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'LearningPlanTodayAPI', methodName: 'GET' }, start)
    return res
  }
}
