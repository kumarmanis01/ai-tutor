import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { getNextUpcomingReview } from '@/lib/student/revisions'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/student/revisions/upcoming
 * Returns the next scheduled review (nextReviewAt > now) for "all caught up" empty state.
 */
export async function GET(req: Request) {
  const start = Date.now()
  try {
    const session = await getServerSessionForHandlers()
    const userId = session?.user?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
      logger.logAPI(req, res, { className: 'StudentRevisionsUpcomingAPI', methodName: 'GET' }, start)
      return res
    }

    const nextReview = await getNextUpcomingReview(userId)
    const payload = nextReview
      ? {
          nextReview: {
            conceptName: nextReview.conceptName,
            nextReviewAt: nextReview.nextReviewAt.toISOString(),
            daysUntil: nextReview.daysUntil,
          },
        }
      : { nextReview: null }

    const res = NextResponse.json(payload, { status: 200 })
    logger.logAPI(req, res, { className: 'StudentRevisionsUpcomingAPI', methodName: 'GET' }, start)
    return res
  } catch (err) {
    const res = NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
    logger.logAPI(req, res, { className: 'StudentRevisionsUpcomingAPI', methodName: 'GET' }, start)
    return res
  }
}
