/**
 * FILE OBJECTIVE:
 * - Admin API route that returns funnel totals (views / completions) for a course over the past 30 days.
 * - Uses DB-side COUNT queries to avoid loading unbounded event rows into memory.
 *
 * LINKED UNIT TEST:
 * - tests/api/admin.analytics.funnel.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | replace in-memory findMany reduce with DB-side COUNT queries; add FILE OBJECTIVE header
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

  // Use last 30 days for funnel overview
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // DB-side COUNT queries to avoid loading unbounded event rows into memory
  const totalViews = await db.analyticsEvent.count({
    where: {
      courseId: String(courseId),
      createdAt: { gte: since },
      eventType: { in: [...ANALYTICS_VIEW_EVENT_SET] },
    },
  })
  const totalCompletions = await db.analyticsEvent.count({
    where: {
      courseId: String(courseId),
      createdAt: { gte: since },
      eventType: { in: [...ANALYTICS_COMPLETION_EVENT_SET] },
    },
  })

  const completionRate = totalViews > 0 ? totalCompletions / totalViews : null

  return NextResponse.json({
    courseId,
    periodStart: since,
    periodEnd: new Date(),
    totalViews,
    totalCompletions,
    completionRate,
  })
}

export default GET
