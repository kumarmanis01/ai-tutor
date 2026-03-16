import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { awardXP } from '@/lib/student/xp'
import { updateStreak } from '@/lib/student/streak'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function buildAiInsight(
  correctAnswers: number,
  totalQuestions: number,
  conceptName: string | null,
): Promise<string | null> {
  if (!totalQuestions) return null
  const name = conceptName ?? 'this concept'
  return `You answered ${correctAnswers}/${totalQuestions} questions correctly on ${name} — nice work, keep going.`
}

export async function POST(req: Request, { params }: { params: { sessionId: string } }) {
  const start = Date.now()
  const { sessionId } = params
  try {
    const session = await getServerSessionForHandlers()
    const userId = session?.user?.id as string | undefined
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'StudentSessionCompleteAPI', methodName: 'POST' }, start)
      return res
    }

    await req.json().catch(() => null)

    const [correctAnswers, totalQuestions] = await Promise.all([
      prisma.answerEvent.count({ where: { studentId: userId, sessionId, isCorrect: true } }),
      prisma.answerEvent.count({ where: { studentId: userId, sessionId } }),
    ])

    const firstAnswer = await prisma.answerEvent.findFirst({
      where: { studentId: userId, sessionId },
      orderBy: { createdAt: 'asc' },
      select: { conceptId: true },
    })
    const conceptId = firstAnswer?.conceptId ?? null

    let masteryAfter = 0.3
    let masteryDelta = 0
    let conceptName: string | null = null

    if (conceptId) {
      const [state, concept] = await Promise.all([
        prisma.studentConceptState.findUnique({
          where: { studentId_conceptId: { studentId: userId, conceptId } },
          select: { masteryScore: true },
        }),
        prisma.concept.findUnique({ where: { id: conceptId }, select: { name: true } }),
      ])
      if (state) {
        masteryAfter = state.masteryScore
        masteryDelta = masteryAfter - 0.3
      }
      conceptName = concept?.name ?? null
    }

    const xpEarned = correctAnswers * 10
    const xpResult = await awardXP({
      studentId: userId,
      amount: xpEarned,
      source: 'session_correct',
      sessionId,
    })
    const totalXp = xpResult?.totalXp ?? xpEarned
    const leveledUp = xpResult?.leveledUp ?? false
    const newLevel = xpResult?.newLevel ?? null

    // Only award streak credit for sessions where the student answered enough
    // questions to have meaningfully progressed through the learning stages.
    // totalQuestions < 5 indicates a login/browse or heavily incomplete session.
    if (totalQuestions >= 5) {
      void updateStreak(userId)
    }

    const learningSession = await prisma.learningSession.findUnique({
      where: { id: sessionId },
      select: { startedAt: true, endedAt: true },
    })

    let sessionDurationMinutes = 0
    if (learningSession) {
      const end = learningSession.endedAt ?? new Date()
      const ms = end.getTime() - learningSession.startedAt.getTime()
      sessionDurationMinutes = Math.max(0, Math.round(ms / 60000))
    }

    let aiInsight: string | null = null
    try {
      aiInsight = await buildAiInsight(correctAnswers, totalQuestions, conceptName)
    } catch {
      aiInsight = null
    }

    const res = NextResponse.json(
      {
        xpEarned,
        totalXp,
        leveledUp,
        newLevel,
        masteryDelta,
        masteryAfter,
        badgesEarned: [] as { name: string; description: string }[],
        aiInsight,
        sessionDurationMinutes,
        correctAnswers,
        totalQuestions,
      },
      { status: 200 },
    )
    logger.logAPI(req, res, { className: 'StudentSessionCompleteAPI', methodName: 'POST' }, start)
    return res
  } catch {
    const res = NextResponse.json({ error: 'Internal error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'StudentSessionCompleteAPI', methodName: 'POST' }, start)
    return res
  }
}

