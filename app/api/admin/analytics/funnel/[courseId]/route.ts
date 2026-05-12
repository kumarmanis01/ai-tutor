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

  const rows = await db.analyticsEvent.findMany({
    where: { courseId: String(courseId), createdAt: { gte: since } },
    select: { eventType: true },
  })

  const totals = rows.reduce(
    (acc: { totalViews: number; totalCompletions: number }, r: { eventType: string }) => {
      if (ANALYTICS_VIEW_EVENT_SET.has(r.eventType)) acc.totalViews += 1
      if (ANALYTICS_COMPLETION_EVENT_SET.has(r.eventType)) acc.totalCompletions += 1
      return acc
    },
    { totalViews: 0, totalCompletions: 0 }
  )

  const completionRate = totals.totalViews > 0 ? totals.totalCompletions / totals.totalViews : null

  return NextResponse.json({
    courseId,
    periodStart: since,
    periodEnd: new Date(),
    totalViews: totals.totalViews,
    totalCompletions: totals.totalCompletions,
    completionRate,
  })
}

export default GET
