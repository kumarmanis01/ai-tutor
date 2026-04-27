import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
  const rows = await db.lessonProgress.findMany({ where: { courseId, userId } })
  return NextResponse.json({ progress: rows })
}

export default GET
