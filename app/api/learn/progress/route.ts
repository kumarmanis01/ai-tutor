import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'

export async function POST(req: Request) {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
  const body = await req.json()
  const { courseId, lessonIdx, completed } = body || {}

  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id
  if (!userId || !courseId || typeof lessonIdx !== 'number') return NextResponse.json({ error: 'Missing fields or unauthorized' }, { status: 400 })

  // require enrollment
  const enrolled = await db.enrollment.findFirst({ where: { userId, courseId } })
  if (!enrolled) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })

  // upsert progress
  const upsert = await db.lessonProgress.upsert({
    where: { userId_courseId_lessonIdx: { userId, courseId, lessonIdx } },
    update: { completed: !!completed },
    create: { userId, courseId, lessonIdx, completed: !!completed }
  })

  return NextResponse.json({ ok: true, progress: upsert })
}

export default POST
