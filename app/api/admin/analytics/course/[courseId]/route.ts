import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'

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

  const aggregates = await db.analyticsDailyAggregate.findMany({
    where: { courseId: String(courseId) },
    orderBy: { day: 'desc' },
    take: 365,
  })

  // Return only aggregated fields — never raw events
  const sanitized = aggregates.map((a: any) => ({
    day: a.day,
    totalViews: a.totalViews,
    totalCompletions: a.totalCompletions,
    avgTimePerLesson: a.avgTimePerLesson,
    completionRate: a.completionRate,
  }))

  return NextResponse.json({ courseId, aggregates: sanitized })
}

export default GET
