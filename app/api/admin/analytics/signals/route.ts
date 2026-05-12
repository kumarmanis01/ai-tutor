import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { ANALYTICS_SIGNAL_EVENT_PREFIX } from '@/lib/analytics/events'

export async function GET(req: Request) {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma

  const session = await getServerSessionForHandlers()
  const role = session?.user?.role ?? ''
  if (!session || role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const url = new URL(req.url)
  const courseId = url.searchParams.get('courseId')
  const where: any = {}
  if (courseId) where.courseId = String(courseId)
  where.eventType = { startsWith: ANALYTICS_SIGNAL_EVENT_PREFIX }

  const rows = await db.analyticsEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 })

  // return safe view (no DB internals)
  const sanitized = rows.map((r: any) => ({
    id: r.id,
    courseId: r.courseId,
    type: r.metadata?.type ?? r.eventType,
    severity: r.metadata?.severity ?? 'INFO',
    metadata: r.metadata,
    createdAt: r.createdAt,
    resolvedAt: r.metadata?.resolvedAt ?? null,
  }))

  return NextResponse.json({ signals: sanitized })
}

export default GET
