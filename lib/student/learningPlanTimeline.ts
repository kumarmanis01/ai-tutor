/**
 * FILE OBJECTIVE:
 * - Build TimelineResponse payload from a learningPlan record and its items.
 * - Shared helper used by the timeline API and the learning-path page.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/learningPlan.timeline.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-18T00:00:00Z | copilot | extract timeline builder used by API and pages
 */

export interface TimelineItem {
  id: string
  conceptId: string
  conceptName: string
  chapterName: string
  chapterId: string
  orderInWeek: number
  status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED'
  isMandatory: boolean
}

export interface TimelineWeek {
  weekNumber: number
  startDate: string
  items: TimelineItem[]
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
export function weekStartDate(baseDate: Date | string, weekNumber: number): string {
  const base = new Date(baseDate)
  const dayOfWeek = base.getDay() === 0 ? 7 : base.getDay() // Mon=1 … Sun=7
  const monday = new Date(base)
  monday.setDate(base.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

/**
 * Build the TimelineResponse from a plan record and its items.
 * - plan may include `items` already (as from a nested Prisma select) or items
 *   may be passed separately via `rawItems`.
 */
export function buildTimeline(plan: any, rawItems?: any[], subjectName?: string): TimelineResponse {
  const items = rawItems ?? plan.items ?? []

  const weekMap = new Map<number, TimelineItem[]>()
  for (const item of items) {
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
      isMandatory: (chapterWeight ?? 0) > 0,
    }
    const existing = weekMap.get(item.weekNumber) ?? []
    existing.push(tItem)
    weekMap.set(item.weekNumber, existing)
  }

  const totalWeeks = weekMap.size > 0 ? Math.max(...weekMap.keys()) : 0
  const baseDate = new Date(plan.generatedAt)

  const weeks: TimelineWeek[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekNumber, items]) => {
      const chapterCountMap = new Map<string, number>()
      for (const it of items) {
        chapterCountMap.set(it.chapterName, (chapterCountMap.get(it.chapterName) ?? 0) + 1)
      }
      const chapterSummary = Array.from(chapterCountMap.entries()).map(([chapterName, sessionCount]) => ({ chapterName, sessionCount }))
      return {
        weekNumber,
        startDate: weekStartDate(baseDate, weekNumber),
        items,
        chapterSummary,
      }
    })

  const completedConcepts = items.filter((i) => i.status === 'COMPLETED').length

  const payload: TimelineResponse = {
    planId: plan.id,
    subjectId: plan.subjectId,
    subjectName: subjectName ?? '',
    examDate: plan.examDate ? new Date(plan.examDate).toISOString() : null,
    weeklyGoal: plan.weeklyGoal,
    totalWeeks,
    totalConcepts: items.length,
    completedConcepts,
    weeks,
  }

  return payload
}
