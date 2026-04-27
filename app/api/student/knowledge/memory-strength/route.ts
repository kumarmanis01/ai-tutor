import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/student/knowledge/memory-strength
 * Body: { chapterIds: string[] }
 * Returns average memoryStrength (0-1) per chapter for the authenticated student.
 */
export async function POST(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const chapterIds = Array.isArray(body?.chapterIds) ? body.chapterIds.filter((x: any) => typeof x === 'string') : []
    if (chapterIds.length === 0) {
      return NextResponse.json({ strengths: {} }, { status: 200 })
    }

    // Fetch StudentConceptState rows for concepts whose topic.chapterId is in chapterIds
    const rows = await prisma.studentConceptState.findMany({
      where: {
        studentId: userId,
        concept: { topic: { chapterId: { in: chapterIds } } },
      },
      select: {
        memoryStrength: true,
        concept: { select: { topic: { select: { chapterId: true } } } },
      },
    })

    const agg: Record<string, { sum: number; count: number }> = {}
    for (const r of rows) {
      const chId = r.concept?.topic?.chapterId
      if (!chId) continue
      if (!agg[chId]) agg[chId] = { sum: 0, count: 0 }
      agg[chId].sum += Number((r as any).memoryStrength ?? 0)
      agg[chId].count += 1
    }

    const strengths: Record<string, number> = {}
    for (const cid of chapterIds) {
      if (agg[cid] && agg[cid].count > 0) strengths[cid] = Math.round((agg[cid].sum / agg[cid].count) * 1000) / 1000
      else strengths[cid] = 0
    }

    const res = NextResponse.json({ strengths }, { status: 200 })
    logger.logAPI(req, res, { className: 'StudentChapterMemoryStrengthAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'StudentChapterMemoryStrengthAPI', methodName: 'POST' }, start)
    return res
  }
}
