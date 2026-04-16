/**
 * FILE OBJECTIVE:
 * - GET /api/student/learning-plan/timeline
 * - Returns the student's learning plan structured as a week-by-week timeline
 *   with chapter sequence and estimated session count per chapter.
 * - Supports AC-04 (F-STU-003): visual timeline with calendar view + chapter sequence.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/learningPlan.timeline.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | created -- AC-04 (F-STU-003) visual timeline endpoint
 * - 2026-04-16T00:30:00Z | copilot | set `isMandatory` when chapter has boardChapterWeights (AC-06)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { formatErrorForResponse } from '@/lib/errorResponse'

export const dynamic = 'force-dynamic'

export interface TimelineItem {
  id: string
  conceptId: string
  conceptName: string
  chapterName: string
  chapterId: string
  orderInWeek: number
  status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED'
  /** Board-exam locked topics cannot be removed from the plan (AC-06). */
  isMandatory: boolean
}

export interface TimelineWeek {
  weekNumber: number
  /** ISO date of Monday for this week (computed from generatedAt + weekNumber). */
  startDate: string
  items: TimelineItem[]
  /** Chapter-level session count summary for this week. */
  chapterSummary: { chapterName: string; sessionCount: number }[]
}

export interface TimelineResponse {
  planId: string
  subjectId: string
  subjectName: string
  examDate: string | null
  weeklyGoal: number
  totalWeeks: number
  totalConcepts: number
  completedConcepts: number
  weeks: TimelineWeek[]
}

/**
 * Compute the Monday start date of a given week offset from a base date.
 * week 1 = the Monday of the week containing baseDate.
 */
export function weekStartDate(baseDate: Date, weekNumber: number): string {
  const base = new Date(baseDate)
  // Normalise to the Monday of that week
  const dayOfWeek = base.getDay() === 0 ? 7 : base.getDay() // Mon=1 … Sun=7
  const monday = new Date(base)
  monday.setDate(base.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

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

    const subject = await prisma.subjectDef.findUnique({
      where: { id: plan.subjectId },
      select: { name: true },
    })

    // Group items by week
    const weekMap = new Map<number, TimelineItem[]>()
    for (const item of rawItems) {
      const chapterId = item.concept.topic.chapter.id
      const chapterName = item.concept.topic.chapter.name
      const chapterWeight = item.concept.topic.chapter.boardChapterWeights?.[0]?.weightMarks ?? 0
      const tItem: TimelineItem = {
        id: item.id,
        conceptId: item.conceptId,
        conceptName: item.concept.name,
        chapterName,
        chapterId,
        orderInWeek: item.orderInWeek,
        status: item.status as TimelineItem['status'],
        // Mark mandatory when the chapter has board weight marks (>0)
        isMandatory: (chapterWeight ?? 0) > 0,
      }
      const existing = weekMap.get(item.weekNumber) ?? []
      existing.push(tItem)
      weekMap.set(item.weekNumber, existing)
    }

    const totalWeeks = weekMap.size > 0 ? Math.max(...weekMap.keys()) : 0
    const baseDate = plan.generatedAt

    // Build week array with chapter summary
    const weeks: TimelineWeek[] = Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNumber, items]) => {
        // Chapter session-count summary
        const chapterCountMap = new Map<string, number>()
        for (const item of items) {
          chapterCountMap.set(item.chapterName, (chapterCountMap.get(item.chapterName) ?? 0) + 1)
        }
        const chapterSummary = Array.from(chapterCountMap.entries()).map(
          ([chapterName, sessionCount]) => ({ chapterName, sessionCount }),
        )
        return {
          weekNumber,
          startDate: weekStartDate(baseDate, weekNumber),
          items,
          chapterSummary,
        }
      })

    const completedConcepts = rawItems.filter((i) => i.status === 'COMPLETED').length

    const payload: TimelineResponse = {
      planId: plan.id,
      subjectId: plan.subjectId,
      subjectName: subject?.name ?? '',
      examDate: plan.examDate ? plan.examDate.toISOString() : null,
      weeklyGoal: plan.weeklyGoal,
      totalWeeks,
      totalConcepts: rawItems.length,
      completedConcepts,
      weeks,
    }

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
