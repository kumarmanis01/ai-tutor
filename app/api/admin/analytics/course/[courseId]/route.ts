/**
 * FILE OBJECTIVE:
 * - Admin API route that returns daily analytics aggregates for a course.
 * - Reads raw AnalyticsEvent rows for the past 365 days and aggregates by day in memory.
 *
 * LINKED UNIT TEST:
 * - tests/api/admin.analytics.course.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | migrate from analyticsDailyAggregate to analyticsEvent; add date filter to bound query window; add FILE OBJECTIVE header
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import {
  ANALYTICS_COMPLETION_EVENT_SET,
  ANALYTICS_VIEW_EVENT_SET,
} from '@/lib/analytics/events'

export async function GET(_req: Request, ctx: any) {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
  const params = ctx?.params || {}
  const { courseId } = params

  const session = await getServerSessionForHandlers()
  const role = session?.user?.role ?? ''
  if (!session || role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 })

  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

  const events = await db.analyticsEvent.findMany({
    where: { courseId: String(courseId), createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: {
      eventType: true,
      metadata: true,
      createdAt: true,
    },
  })

  const byDay = new Map<string, {
    day: Date
    totalViews: number
    totalCompletions: number
    timeSum: number
    timeCount: number
  }>()

  for (const ev of events) {
    const day = new Date(ev.createdAt)
    day.setUTCHours(0, 0, 0, 0)
    const dayKey = day.toISOString()

    const agg = byDay.get(dayKey) ?? {
      day,
      totalViews: 0,
      totalCompletions: 0,
      timeSum: 0,
      timeCount: 0,
    }

    if (ANALYTICS_VIEW_EVENT_SET.has(ev.eventType)) agg.totalViews += 1
    if (ANALYTICS_COMPLETION_EVENT_SET.has(ev.eventType)) agg.totalCompletions += 1

    const timeSpent = ev.metadata && typeof ev.metadata === 'object'
      ? (ev.metadata as Record<string, unknown>).timeSpent
      : undefined
    if (typeof timeSpent === 'number' && !Number.isNaN(timeSpent)) {
      agg.timeSum += timeSpent
      agg.timeCount += 1
    }

    byDay.set(dayKey, agg)
  }

  // Return only aggregated fields -- never raw events
  const sanitized = Array.from(byDay.values())
    .map((a) => ({
      day: a.day,
      totalViews: a.totalViews,
      totalCompletions: a.totalCompletions,
      avgTimePerLesson: a.timeCount > 0 ? a.timeSum / a.timeCount : null,
      completionRate: a.totalViews > 0 ? a.totalCompletions / a.totalViews : null,
    }))
    .sort((a, b) => b.day.getTime() - a.day.getTime())
    .slice(0, 365)

  return NextResponse.json({ courseId, aggregates: sanitized })
}

export default GET
