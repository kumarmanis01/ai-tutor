/**
 * FILE OBJECTIVE:
 * - POST /api/student/session/[sessionId]/complete
 * - Marks a learning session complete, computes multi-source XP (duration,
 *   correct answers, first-attempt bonus, streak multiplier), updates streak,
 *   awards badges, and returns the session summary to the client.
 * - AC-01 (F-STU-031): XP calculation sources documented inline.
 * - Gap 3 fix (PROGRESS_PAGE_GAP_AUDIT.md): writes computed score (0-100) to
 *   StructuredSession.meta.score via the learningSession bridge so the
 *   /student/progress session history table can display it.
 *
 * EDIT LOG:
 * - 2026-03-15 | v2-migration | created for session completion flow
 * - 2026-05-04 | staff-engineer | AC-01 F-STU-031: add duration XP, first-attempt
 *   bonus, streak daily multiplier; fix leveledUp/newLevel to reflect final XP
 *   award (streak bonus can trigger level-up independently)
 * - 2026-05-09T00:00:00Z | copilot | fix Gap 3: write meta.score to StructuredSession
 *   via bridge so progress page session history can display session scores
 * - 2026-05-10 | staff-engineer | wire session-complete notifications: student email/
 *   WhatsApp celebration + parent email/WhatsApp; fire-and-forget after response build
 * - 2026-05-11T00:00:00Z | copilot | record daily study time and return dailyStudyLimit in response
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { awardXP } from '@/lib/student/xp'
import { updateStreak } from '@/lib/student/streak'
import { buildSessionInsight } from '@/lib/student/sessionInsight'
import { checkSessionBadges } from '@/lib/student/badges'
import { logger } from '@/lib/logger'
import { notifyStudentOnSessionComplete } from '@/lib/notifications/studentNotify'
import { notifyParent, DEFAULT_DASHBOARD_URL } from '@/lib/notifications/parentNotify'
import { PARENT_NOTIF_EVENTS } from '@/lib/constants/mail'
import { updateDailyStudyTime, checkDailyStudyLimit } from '@/lib/student/dailyStudyLimit'

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
    let subjectName: string | null = null

    if (conceptId) {
      const [state, concept] = await Promise.all([
        prisma.studentConceptState.findUnique({
          where: { studentId_conceptId: { studentId: userId, conceptId } },
          select: { masteryScore: true },
        }),
        prisma.concept.findUnique({
          where: { id: conceptId },
          select: { name: true, subject: { select: { name: true } } },
        }),
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
      subjectName = concept?.subject?.name ?? null
    }

    let sessionDurationMinutes = 0
    if (learningSession) {
      const end = learningSession.endedAt ?? new Date()
      const ms = end.getTime() - learningSession.startedAt.getTime()
      // Count only fully elapsed minutes to avoid inflating XP for partial minutes.
      sessionDurationMinutes = Math.max(0, Math.floor(ms / 60000))
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
    // leveledUp/newLevel start from the base XP award and may be updated by the streak
    // bonus below -- the streak bonus can independently push the student to a new level.
    let leveledUp = xpResult?.leveledUp ?? false
    let newLevel = xpResult?.newLevel ?? null

    // Award streak credit and capture result for badge checking.
    // Awaited so currentStreak is up-to-date when checkSessionBadges runs below.
    let currentStreak = 0
    if (totalQuestions >= 5) {
      const streakResult = await updateStreak(userId)
      currentStreak = streakResult?.currentStreak ?? 0
    // AC-01 (F-STU-031): streak maintenance daily multiplier -- bonus XP when streak advances.
      if (streakResult?.streakIncremented) {
        const streakBonusXP = Math.round(xpEarned * 0.1)
        const streakXpResult = await awardXP({
          studentId: userId,
          amount: streakBonusXP,
          source: 'streak_bonus',
          sessionId,
        })
        if (streakXpResult) {
          totalXp = streakXpResult.totalXp
          // Streak bonus may have triggered a level-up; use the final result.
          if (streakXpResult.leveledUp) {
            leveledUp = true
            newLevel = streakXpResult.newLevel
          }
        }
      }
    }

    // Record session duration toward the user's daily study budget.
    // Fire-and-forget: never block the response if accounting fails.
    updateDailyStudyTime(userId, sessionDurationMinutes).catch((err) =>
      logger.warn('StudentSessionCompleteAPI: daily study time update failed', {
        event: 'daily_study_time_error',
        context: { userId, sessionId, sessionDurationMinutes, error: String(err) },
      }),
    )

    // Fetch updated daily limit so the client can show remaining study time.
    const dailyStudyLimitStatus = await checkDailyStudyLimit(userId)

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

    // Gap 3 fix: write score (0-100 integer) to StructuredSession.meta so the
    // /student/progress session history table can display it.
    // The sessionId here is a LearningSession.id; we get the StructuredSession.id
    // from the bridge meta field written by createBridgedLearningSession.
    const structuredSessionId = (learningSession?.meta as any)?.structuredSessionId
    if (structuredSessionId && typeof structuredSessionId === 'string') {
      const scorePercent = Math.round(accuracy * 100)
      try {
        const existing = await prisma.structuredSession.findUnique({
          where: { id: structuredSessionId },
          select: { meta: true },
        })
        if (existing) {
          await prisma.structuredSession.update({
            where: { id: structuredSessionId },
            data: {
              meta: {
                ...((existing.meta as object) ?? {}),
                score: scorePercent,
              },
            },
          })
        }
      } catch (scoreWriteErr) {
        // Non-fatal: log but do not surface to client
        logger.warn('StudentSessionCompleteAPI: failed to write score to StructuredSession.meta', {
          event: 'session_score_write_error',
          context: { userId, sessionId, structuredSessionId, error: String(scoreWriteErr) },
        })
      }
    }

    const badgeNames = badgesEarned.map((b) => b.name)
    const sessionDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

    // Fire-and-forget: send session-complete celebration to student and parent.
    // Errors inside each notifier are caught and logged; never block the response.
    notifyStudentOnSessionComplete(userId, {
      xpEarned,
      totalXp,
      currentStreak,
      conceptName,
      masteryDelta,
      masteryAfter,
      accuracy,
      badgeNames,
      sessionDurationMinutes,
      leveledUp,
      newLevel,
    }).catch((err) =>
      logger.warn('StudentSessionCompleteAPI: student notification failed', {
        event: 'session_student_notif_error',
        context: { userId, sessionId, error: String(err) },
      }),
    )

    notifyParent(userId, {
      event: PARENT_NOTIF_EVENTS.SESSION_COMPLETE,
      data: {
        topicName: conceptName ?? 'a topic',
        subjectName: subjectName ?? 'your subject',
        sessionDate,
        dashboardUrl: DEFAULT_DASHBOARD_URL,
      },
    }).catch((err) =>
      logger.warn('StudentSessionCompleteAPI: parent notification failed', {
        event: 'session_parent_notif_error',
        context: { userId, sessionId, error: String(err) },
      }),
    )

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
        dailyStudyLimit: {
          limitMinutes: dailyStudyLimitStatus.limitMinutes,
          usedMinutes: dailyStudyLimitStatus.usedMinutes,
          remainingMinutes: dailyStudyLimitStatus.remainingMinutes,
          resetAt: dailyStudyLimitStatus.resetAt.toISOString(),
          tier: dailyStudyLimitStatus.tier,
        },
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
