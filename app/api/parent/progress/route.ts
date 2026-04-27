/**
 * GET /api/parent/progress
 *
 * Domain 7 §7.10 -- returns all linked children with per-subject readiness,
 * study time, alerts, and mastery delta for the authenticated parent.
 *
 * Auth: parent role required.
 *
 * Response shape:
 * {
 *   children: Array<{
 *     studentId, name, grade, board,
 *     streakDays, sessionsThisWeek, studyTimeThisWeekMinutes,
 *     subjects: Array<{
 *       subjectId, subjectName, readinessScore, daysToExam, recentMasteryChange
 *     }>,
 *     recentAlerts: Array<{ type, message, occurredAt }>
 *   }>
 * }
 *
 * EDIT LOG:
 *   2026-02-04 | claude | original per-student ?studentId query
 *   2026-03-15 | claude | T39 -- full D7 §7.10 multi-child contract
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { computeReadinessScore } from '@/lib/student/examReadiness'
import type { AppSession } from '@/lib/types/auth'

const CLASS_NAME = 'ParentProgressAPI'

type AlertType = 'readiness_drop' | 'streak_break' | 'milestone'

interface SubjectResult {
  subjectId: string
  subjectName: string
  readinessScore: number
  daysToExam: number | null
  recentMasteryChange: number | null // delta 0-1 float; positive = improved; null if no data
}

interface RecentAlert {
  type: AlertType
  message: string
  occurredAt: string // ISO timestamp
}

function weekStart(): Date {
  const now = new Date()
  const dow = now.getUTCDay()
  const distToMonday = dow === 0 ? 6 : dow - 1
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - distToMonday)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

export async function GET(req: Request) {
  const start = Date.now()
  const session = (await getServerSession(authOptions)) as AppSession | null

  if (!session?.user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'GET' }, start)
    return res
  }

  if (session.user.role !== 'parent') {
    const res = NextResponse.json({ error: 'Parent role required' }, { status: 403 })
    logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'GET' }, start)
    return res
  }

  const parentId = session.user.id
  const monday = weekStart()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // All active linked children
  const links = await prisma.parentStudent.findMany({
    where: { parentId, status: 'active' },
    select: { studentId: true },
  })

  // Compute children sequentially to avoid overloading DB connections
  const children: Array<ReturnType<typeof Promise.resolve> | null> = []
  for (const { studentId } of links) {
    // ── Core data in parallel (small set of parallel queries per student)
    const [student, streak, sessionsThisWeek, learningPlans] = await Promise.all([
      prisma.user.findUnique({
        where: { id: studentId },
        select: { name: true, grade: true, board: true, subjects: true },
      }),
      prisma.studentStreak.findFirst({
        where: { studentId, kind: 'daily' },
        select: { current: true, lastActive: true },
      }),
      prisma.structuredSession.findMany({
        where: { studentId, startedAt: { gte: monday } },
        select: { startedAt: true, completedAt: true },
      }),
      prisma.learningPlan.findMany({
        where: { studentId },
        select: { subjectId: true, examDate: true },
      }),
    ])

    if (!student) {
      children.push(null)
      continue
    }

    // ── Study time this week (minutes)
    const studyTimeThisWeekMinutes = sessionsThisWeek.reduce((sum, s) => {
      if (!s.completedAt) return sum
      const mins = (s.completedAt.getTime() - s.startedAt.getTime()) / 60_000
      return sum + Math.max(0, mins)
    }, 0)

    // Resolve subjects → SubjectDef IDs
    const subjectNames = (student.subjects as string[]).filter(Boolean)
    const subjectDefs = subjectNames.length
      ? await prisma.subjectDef.findMany({
          where: {
            lifecycle: 'active',
            OR: [{ name: { in: subjectNames } }, { slug: { in: subjectNames } }],
          },
          select: { id: true, name: true },
        })
      : []

    // Exam-date map by subjectId
    const examDateMap = new Map<string, Date | null>()
    for (const lp of learningPlans) {
      if (!examDateMap.has(lp.subjectId)) {
        examDateMap.set(lp.subjectId, lp.examDate ?? null)
      }
    }

    // Per-subject readiness + mastery delta (sequential per-subject)
    const subjects: SubjectResult[] = []
    for (const sd of subjectDefs) {
      const readiness = await computeReadinessScore(studentId, sd.id).catch(() => null)
      const readinessScore = readiness?.score ?? 0

      const examDate = examDateMap.get(sd.id) ?? null
      const daysToExam = examDate ? Math.ceil((examDate.getTime() - Date.now()) / 86_400_000) : null

      const recentStates = await prisma.studentConceptState.findMany({
        where: {
          studentId,
          updatedAt: { gte: sevenDaysAgo },
          concept: { subjectId: sd.id },
        },
        select: { masteryScore: true },
      })
      const allStates = await prisma.studentConceptState.findMany({
        where: { studentId, concept: { subjectId: sd.id } },
        select: { masteryScore: true },
      })

      let recentMasteryChange: number | null = null
      if (recentStates.length > 0 && allStates.length > 0) {
        const allAvg = allStates.reduce((s, r) => s + r.masteryScore, 0) / allStates.length
        const recentAvg = recentStates.reduce((s, r) => s + r.masteryScore, 0) / recentStates.length
        recentMasteryChange = Math.round((recentAvg - allAvg) * 1000) / 1000
      }

      subjects.push({
        subjectId: sd.id,
        subjectName: sd.name,
        readinessScore,
        daysToExam,
        recentMasteryChange,
      })
    }

    // Alerts
    const recentAlerts: RecentAlert[] = []
    const now = new Date()
    if (streak && streak.current === 0 && streak.lastActive) {
      const daysSince = Math.floor((now.getTime() - streak.lastActive.getTime()) / 86_400_000)
      if (daysSince <= 3) {
        recentAlerts.push({
          type: 'streak_break',
          message: 'Study streak ended -- encourage getting back on track',
          occurredAt: streak.lastActive.toISOString(),
        })
      }
    }

    for (const s of subjects) {
      if (s.recentMasteryChange !== null && s.recentMasteryChange < -0.1) {
        recentAlerts.push({
          type: 'readiness_drop',
          message: `${s.subjectName} readiness may have dropped -- recent concepts below average`,
          occurredAt: sevenDaysAgo.toISOString(),
        })
      }
    }

    const milestoneCount = await prisma.studentConceptState.count({
      where: { studentId, masteryScore: { gte: 0.9 }, updatedAt: { gte: monday } },
    })
    if (milestoneCount > 0) {
      recentAlerts.push({
        type: 'milestone',
        message: `Mastered ${milestoneCount} concept${milestoneCount > 1 ? 's' : ''} this week!`,
        occurredAt: now.toISOString(),
      })
    }

    children.push({
      studentId,
      name: student.name ?? 'Student',
      grade: student.grade ?? '',
      board: student.board ?? '',
      streakDays: streak?.current ?? 0,
      sessionsThisWeek: sessionsThisWeek.length,
      studyTimeThisWeekMinutes: Math.round(studyTimeThisWeekMinutes),
      subjects,
      recentAlerts,
    })
  }

  const validChildren = children.filter(
    (c): c is NonNullable<typeof c> => c !== null,
  )

  const res = NextResponse.json({ children: validChildren }, { status: 200 })
  logger.logAPI(req, res, { className: CLASS_NAME, methodName: 'GET' }, start)
  return res
}
