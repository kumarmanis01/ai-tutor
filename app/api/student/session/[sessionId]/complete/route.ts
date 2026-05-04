import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { awardXP } from '@/lib/student/xp'
import { updateStreak } from '@/lib/student/streak'
import { buildSessionInsight } from '@/lib/student/sessionInsight'
import { checkSessionBadges } from '@/lib/student/badges'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const start = Date.now()
  const { sessionId } = await params
  try {
    const session = await getServerSessionForHandlers()
    const userId = session?.user?.id as string | undefined
    if (!userId) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.logAPI(req, res, { className: 'StudentSessionCompleteAPI', methodName: 'POST' }, start)
      return res
    }

    await req.json().catch(() => null)

    // Ensure the requested learning session belongs to the authenticated user
    // before reading any session-derived data. This prevents a caller from
    // querying session-scoped artifacts for a session that does not belong to
    // their account.
    const learningSession = await prisma.learningSession.findFirst({
      where: { id: sessionId, studentId: userId },
      select: { startedAt: true, endedAt: true, meta: true },
    })
    if (!learningSession) {
      const res = NextResponse.json({ error: 'Session not found' }, { status: 404 })
      logger.logAPI(req, res, { className: 'StudentSessionCompleteAPI', methodName: 'POST' }, start)
      return res
    }

    // Fire remaining session-level reads in parallel; none depend on each other.
    const [correctAnswers, totalQuestions, hintsUsed, firstAnswer] = await Promise.all([
      prisma.answerEvent.count({ where: { studentId: userId, sessionId, isCorrect: true } }),
      prisma.answerEvent.count({ where: { studentId: userId, sessionId } }),
      prisma.aITutorTurnLog.count({ where: { sessionId, callType: 'tutor:hint' } }),
      prisma.answerEvent.findFirst({
        where: { studentId: userId, sessionId },
        orderBy: { createdAt: 'asc' },
        select: { conceptId: true },
      }),
    ])

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
        // Use preSessionMastery stored at session start; fall back to 0.3 for
        // sessions created before this fix was deployed.
        const preSessionMastery: number =
          typeof (learningSession?.meta as any)?.preSessionMastery === 'number'
            ? (learningSession!.meta as any).preSessionMastery
            : 0.3
        masteryDelta = masteryAfter - preSessionMastery
      }
      conceptName = concept?.name ?? null
    }

    let sessionDurationMinutes = 0
    if (learningSession) {
      const end = learningSession.endedAt ?? new Date()
      const ms = end.getTime() - learningSession.startedAt.getTime()
      sessionDurationMinutes = Math.max(0, Math.round(ms / 60000))
    }

    // AC-01 (F-STU-031): multi-source XP calculation.
    // 1. Base XP by session duration (2 XP/min, cap 60 min).
    const durationXP = Math.min(sessionDurationMinutes, 60) * 2
    // 2. Correct answers XP (per question, flat rate per difficulty approximation).
    const correctAnswerXP = correctAnswers * 10
    // 3. First-attempt correct 1.5x bonus: no hints used in session means first-attempt answers.
    const firstAttemptBonus = hintsUsed === 0 && correctAnswers > 0
      ? Math.round(correctAnswerXP * 0.5)
      : 0
    const xpEarned = durationXP + correctAnswerXP + firstAttemptBonus

    const xpResult = await awardXP({
      studentId: userId,
      amount: xpEarned,
      source: 'session_correct',
      sessionId,
    })
    let totalXp = xpResult?.totalXp ?? xpEarned
    const leveledUp = xpResult?.leveledUp ?? false
    const newLevel = xpResult?.newLevel ?? null

    // Award streak credit and capture result for badge checking.
    // Awaited so currentStreak is up-to-date when checkSessionBadges runs below.
    let currentStreak = 0
    if (totalQuestions >= 5) {
      const streakResult = await updateStreak(userId)
      currentStreak = streakResult?.currentStreak ?? 0
      // AC-01 (F-STU-031): streak maintenance daily multiplier -- bonus XP when streak advances.
      if (streakResult?.streakIncremented) {
        const streakBonusXP = Math.max(5, Math.round(xpEarned * 0.1))
        const streakXpResult = await awardXP({
          studentId: userId,
          amount: streakBonusXP,
          source: 'streak_bonus',
          sessionId,
        })
        if (streakXpResult) totalXp = streakXpResult.totalXp
      }
    }

    // AC-03 (F-STU-015 MUST): AI-generated personalised closing insight, not a template.
    const aiInsight = await buildSessionInsight({
      correctAnswers,
      totalQuestions,
      conceptName,
      hintsUsed,
      masteryDelta,
      studentId: userId,
      sessionId,
    })

    // AC-04 (F-STU-031): check for newly earned badges this session.
    const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0
    const avgTimeSeconds = totalQuestions > 0 ? (sessionDurationMinutes * 60) / totalQuestions : 0

    const badgesEarned = await checkSessionBadges({
      studentId: userId,
      sessionId,
      currentStreak,
      masteryAfter,
      accuracy,
      avgTimeSeconds,
    })

    const res = NextResponse.json(
      {
        xpEarned,
        totalXp,
        leveledUp,
        newLevel,
        masteryDelta,
        masteryAfter,
        badgesEarned: badgesEarned.map((b) => ({ name: b.name, description: b.description, icon: b.icon })),
        aiInsight,
        sessionDurationMinutes,
        correctAnswers,
        totalQuestions,
      },
      { status: 200 },
    )
    logger.logAPI(req, res, { className: 'StudentSessionCompleteAPI', methodName: 'POST' }, start)
    return res
  } catch (err) {
    logger.error('StudentSessionCompleteAPI failed', { className: 'StudentSessionCompleteAPI', methodName: 'POST', error: String(err) })
    const res = NextResponse.json({ error: 'Internal error' }, { status: 500 })
    logger.logAPI(req, res, { className: 'StudentSessionCompleteAPI', methodName: 'POST' }, start)
    return res
  }
}
