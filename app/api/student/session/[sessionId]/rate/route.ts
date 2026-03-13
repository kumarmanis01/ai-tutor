import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(req: Request, { params }: { params: { sessionId: string } }) {
  const start = Date.now()
  const { sessionId } = params
  try {
    const session = await getServerSessionForHandlers()
    const userId = (session?.user as { id?: string })?.id
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'StudentSessionRateAPI', methodName: 'POST' }, start)
      return res
    }

    const body = await req.json().catch(() => null)
    const rating = typeof body?.rating === 'number' ? body.rating : null
    const feedback = typeof body?.feedback === 'string' ? body.feedback.trim() : null

    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      const res = NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
      logger.logAPI(req, res, { className: 'StudentSessionRateAPI', methodName: 'POST' }, start)
      return res
    }

    await prisma.learningSession.updateMany({
      where: { id: sessionId, studentId: userId },
      data: {
        rating,
        ratingFeedback: feedback && feedback.length > 0 ? feedback : null,
        ratedAt: new Date(),
      },
    })

    const res = NextResponse.json({ success: true }, { status: 200 })
    logger.logAPI(req, res, { className: 'StudentSessionRateAPI', methodName: 'POST' }, start)
    return res
  } catch {
    const res = NextResponse.json({ success: false }, { status: 200 })
    logger.logAPI(req, res, { className: 'StudentSessionRateAPI', methodName: 'POST' }, start)
    return res
  }
}

