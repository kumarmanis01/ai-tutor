import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'

export async function GET(_req: Request, { params }: { params: { courseId: string } }) {
  const { courseId } = params
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma

  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id ?? null

  const row = await db.coursePackage.findFirst({
    where: { syllabusId: courseId, status: 'PUBLISHED' },
    orderBy: { version: 'desc' }
  })

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { hasLearnerAccess } = await import('../../../../../lib/guards/access')
  const allowed = await hasLearnerAccess(db, userId, courseId, session?.user?.tenantId ?? null)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(row.json)
}

export default GET
