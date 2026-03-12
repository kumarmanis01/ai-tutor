import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const MS_PER_DAY = 86400000
const LIMIT = 20

/**
 * GET /api/student/revisions/due-today
 * Domain 7 §7.7 — revisions due for the authenticated student (nextReviewAt <= now).
 */
export async function GET(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const userId = session?.user?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'StudentRevisionsDueTodayAPI', methodName: 'GET' }, start)
      return res
    }

    const now = new Date()

    const [states, totalDue] = await Promise.all([
      prisma.studentConceptState.findMany({
        where: {
          studentId: userId,
          nextReviewAt: { lte: now },
        },
        orderBy: { nextReviewAt: 'asc' },
        take: LIMIT,
      }),
      prisma.studentConceptState.count({
        where: {
          studentId: userId,
          nextReviewAt: { lte: now },
        },
      }),
    ])

    const conceptIds = [...new Set(states.map((s) => s.conceptId))]
    const concepts =
      conceptIds.length > 0
        ? await prisma.concept.findMany({
            where: { id: { in: conceptIds } },
            select: { id: true, name: true, subject: { select: { name: true } } },
          })
        : []
    const conceptMap = new Map(concepts.map((c) => [c.id, { name: c.name, subjectName: c.subject.name }]))

    const revisions = states.map((s) => {
      const meta = conceptMap.get(s.conceptId)
      const nextReviewAt = s.nextReviewAt!
      const overdueMs = now.getTime() - nextReviewAt.getTime()
      const overdueByDays = Math.max(0, overdueMs / MS_PER_DAY)

      return {
        conceptId: s.conceptId,
        conceptName: meta?.name ?? 'Unknown',
        subjectName: meta?.subjectName ?? 'Unknown',
        masteryScore: s.masteryScore,
        retention: s.retention,
        nextReviewAt: nextReviewAt.toISOString(),
        overdueByDays: Math.round(overdueByDays * 10) / 10,
      }
    })

    const res = NextResponse.json(
      {
        revisions,
        totalDue,
      },
      { status: 200 },
    )
    logger.logAPI(req, res, { className: 'StudentRevisionsDueTodayAPI', methodName: 'GET' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
    logger.logAPI(req, res, { className: 'StudentRevisionsDueTodayAPI', methodName: 'GET' }, start)
    return res
  }
}
