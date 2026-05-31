/**
 * FILE OBJECTIVE:
 * - GET /api/student/progress
 * - Returns progress data for the new student progress screen (ProgressData shape).
 * - Also preserves legacy fields (topicsCompleted, sessionsCompleted, etc.)
 *   so any other callers are not broken.
 *
 * EDIT LOG:
 * - 2026-03-06 | Manish Kumar | created for WeeklyProgress dashboard card
 * - 2026-05-31 | claude | add ProgressData fields for new student progress screen
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import { getReadinessTier } from '@/lib/constants/readiness'
import { logger } from '@/lib/logger'
import type { TierKey } from '@/lib/constants/tiers'
import type { SubjectKey } from '@/lib/constants/subjects'

export const dynamic = 'force-dynamic'

const AVG_SESSION_MINUTES = 20
const DEFAULT_DAILY_TARGET_MIN = 30
const DEFAULT_STUDY_DAYS_PER_WEEK = 5

function weekStart(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

function toSubjectKey(name: string): SubjectKey {
  const n = name.toLowerCase()
  if (n.includes('math')) return 'math'
  if (n.includes('science') && !n.includes('social')) return 'science'
  if (n.includes('social')) return 'social'
  if (n.includes('english')) return 'english'
  if (n.includes('hindi')) return 'hindi'
  return n as SubjectKey
}

export async function GET(req: Request) {
  const start = Date.now()

  const authSession = await getServerSessionForHandlers()
  const user = authSession?.user

  if (!user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    logger.logAPI(req, res, { className: 'StudentProgressAPI', methodName: 'GET' }, start)
    return res
  }

  const userId = user.id
  const weekBegin = weekStart()

  // 30 days ago for trend data
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)

  const [
    userRow,
    profile,
    readinessRows,
    sessionsThisWeek,
    sessions30d,
    topicProgressRows,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { totalXp: true, level: true, currentStreak: true, longestStreak: true },
    }),
    prisma.studentLearningProfile.findUnique({
      where: { studentId: userId },
      select: { dailyTargetMin: true, studyDaysPerWeek: true },
    }),
    prisma.readinessStatus.findMany({
      where: { studentId: userId },
      select: { subject: true, readinessScore: true, topicsCovered: true, totalTopics: true },
    }),
    prisma.structuredSession.findMany({
      where: { studentId: userId, startedAt: { gte: weekBegin } },
      select: {
        completedAt: true,
        startedAt: true,
        topic: { select: { chapter: { select: { subject: { select: { name: true } } } } } },
      },
    }),
    prisma.structuredSession.findMany({
      where: { studentId: userId, startedAt: { gte: thirtyDaysAgo }, completedAt: { not: null } },
      select: { startedAt: true },
      orderBy: { startedAt: 'asc' },
    }),
    prisma.studentTopicProgress.findMany({
      where: { studentId: userId },
      select: { subjectId: true, mastery: true },
    }),
  ])

  // --- Legacy fields ---
  const topicsCompleted = topicProgressRows.filter((r) => r.mastery >= 0.8).length
  const subjectSet = new Set(sessionsThisWeek.map((s) => s.topic.chapter.subject.name))
  const sessionsCompleted = sessionsThisWeek.filter((s) => s.completedAt !== null).length
  const subjectsExplored = subjectSet.size
  const minutesStudied = sessionsThisWeek.length * AVG_SESSION_MINUTES
  const dailyTarget = profile?.dailyTargetMin ?? DEFAULT_DAILY_TARGET_MIN
  const studyDays = profile?.studyDaysPerWeek ?? DEFAULT_STUDY_DAYS_PER_WEEK
  const weeklyGoalMinutes = dailyTarget * studyDays

  // --- New ProgressData fields ---

  // Per-subject progress from ReadinessStatus
  const subjects = readinessRows.map((r) => {
    const tier = getReadinessTier(r.readinessScore) as TierKey
    const subjectKey = toSubjectKey(r.subject)

    // Build 7-day activity: count sessions per weekday (Mon=0..Sun=6)
    const weeklyActivity = Array(7).fill(0) as number[]
    const mondayMs = weekBegin.getTime()
    for (const s of sessionsThisWeek) {
      if (s.topic.chapter.subject.name !== r.subject) continue
      const dayIndex = Math.floor((s.startedAt.getTime() - mondayMs) / 86_400_000)
      if (dayIndex >= 0 && dayIndex < 7) {
        weeklyActivity[dayIndex] = Math.min(100, weeklyActivity[dayIndex] + 30)
      }
    }

    return {
      subject: subjectKey,
      tier,
      topicsCompleted: r.topicsCovered,
      topicsTotal: r.totalTopics,
      weeklyActivity,
    }
  })

  // Overall tier: average readiness across subjects
  const avgReadiness =
    readinessRows.length > 0
      ? readinessRows.reduce((sum, r) => sum + r.readinessScore, 0) / readinessRows.length
      : 0
  const overallTier = getReadinessTier(avgReadiness) as TierKey

  // Trend arrays: sessions-per-day as a 0-100 proxy for engagement
  // True readiness trends would require historical snapshots; use session activity as proxy
  function buildTrend(daysBack: number): number[] {
    const trend = Array(daysBack).fill(0) as number[]
    const now = Date.now()
    for (const s of sessions30d) {
      const daysAgo = Math.floor((now - s.startedAt.getTime()) / 86_400_000)
      const idx = daysBack - 1 - daysAgo
      if (idx >= 0 && idx < daysBack) {
        trend[idx] = Math.min(100, trend[idx] + 20)
      }
    }
    return trend
  }

  const trend7 = buildTrend(7)
  const trend30 = buildTrend(30)

  const res = NextResponse.json({
    // New ProgressData shape (used by new progress screen)
    streak: userRow?.currentStreak ?? 0,
    xp: userRow?.totalXp ?? 0,
    xpLevel: userRow?.level ?? 1,
    overallTier,
    subjects,
    trend7,
    trend30,
    // Legacy fields preserved for any existing callers
    topicsCompleted,
    sessionsCompleted,
    subjectsExplored,
    weeklyGoalMinutes,
    minutesStudied,
  })

  logger.logAPI(req, res, { className: 'StudentProgressAPI', methodName: 'GET' }, start)
  return res
}
