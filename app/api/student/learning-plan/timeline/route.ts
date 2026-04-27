/**
 * FILE OBJECTIVE:
 * - GET /api/student/learning-plan/timeline
 * - Returns the student's learning plan structured as a week-by-week timeline
 *   with chapter sequence and estimated session count per chapter.
 * - Supports AC-04 (F-STU-003): visual timeline with calendar view + chapter sequence.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/learningPlan.timeline.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | created -- AC-04 (F-STU-003) visual timeline endpoint
 * - 2026-04-16T00:30:00Z | copilot | set `isMandatory` when chapter has boardChapterWeights (AC-06)
 * - 2026-04-18T00:00:00Z | copilot | refactor: use shared buildTimeline helper (lib/student)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { formatErrorForResponse } from '@/lib/errorResponse'
import { buildTimeline } from '@/lib/student/learningPlanTimeline'

export const dynamic = 'force-dynamic'

// Timeline types and week-start logic extracted to lib/student/learningPlanTimeline

export async function GET(req: NextRequest) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const userId = (session?.user as { id?: string })?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'LearningPlanTimelineAPI', methodName: 'GET' }, start)
      return res
    }

    // Optional ?subjectId= query param; defaults to first plan
    const { searchParams } = new URL(req.url)
    const subjectIdParam = searchParams.get('subjectId')

    const planWhere = subjectIdParam
      ? { studentId: userId, subjectId: subjectIdParam }
      : undefined

    const plan = subjectIdParam
      ? await prisma.learningPlan.findFirst({
          where: planWhere,
          select: {
            id: true,
            subjectId: true,
            examDate: true,
            weeklyGoal: true,
            generatedAt: true,
          },
        })
      : await prisma.learningPlan.findFirst({
          where: { studentId: userId },
          orderBy: { generatedAt: 'desc' },
          select: {
            id: true,
            subjectId: true,
            examDate: true,
            weeklyGoal: true,
            generatedAt: true,
          },
        })

    if (!plan) {
      const res = NextResponse.json({ error: 'No learning plan found' }, { status: 404 })
      logger.logAPI(req, res, { className: 'LearningPlanTimelineAPI', methodName: 'GET' }, start)
      return res
    }

    // Fetch all plan items with concept + chapter info in a single join query
    const rawItems = await prisma.learningPlanItem.findMany({
      where: { planId: plan.id },
      orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
      select: {
        id: true,
        conceptId: true,
        weekNumber: true,
        orderInWeek: true,
        status: true,
        concept: {
          select: {
            name: true,
            topic: {
              select: {
                chapter: {
                  select: {
                    id: true,
                    name: true,
                    // Include board chapter weight so we can mark mandatory topics
                    boardChapterWeights: { select: { weightMarks: true }, take: 1 },
                  },
                },
              },
            },
          },
        },
      },
    })

    const subject = await prisma.subjectDef.findUnique({ where: { id: plan.subjectId }, select: { name: true } })

    // Use shared builder to construct the timeline payload
    const payload = buildTimeline(plan, rawItems, subject?.name ?? '')

    const res = NextResponse.json(payload, { status: 200 })
    logger.logAPI(req, res, { className: 'LearningPlanTimelineAPI', methodName: 'GET' }, start)
    return res
  } catch (err) {
    logger.error('LearningPlanTimelineAPI GET error', {
      className: 'LearningPlanTimelineAPI',
      methodName: 'GET',
      error: err,
    })
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 })
  }
}
