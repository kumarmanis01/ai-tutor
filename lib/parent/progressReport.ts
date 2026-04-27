import { prisma } from '@/lib/prisma'
import { computeExamReadiness } from '@/lib/student/examReadiness'

export interface ParentProgressReport {
  student: {
    name: string
    grade: number
    board: string
    currentStreak: number
    longestStreak: number
    level: number
    totalXp: number
  }
  weekSummary: {
    sessionsThisWeek: number
    minutesThisWeek: number
    questionsAttempted: number
    correctAnswers: number
    accuracyPercent: number
  }
  masteryBySubject: Array<{
    subjectName: string
    examReadinessScore: number
    readinessLabel: string
    topWeakChapters: Array<{
      chapterName: string
      avgMastery: number
    }>
  }>
  recentActivity: Array<{
    date: string
    durationMinutes: number
    conceptsStudied: number
    xpEarned: number
  }>
  safetyFlags: number
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
}

function daysAgoUtcStart(daysAgo: number): Date {
  const d = startOfUtcDay(new Date())
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d
}

function formatDateShort(d: Date): string {
  // "12 Mar 2026"
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function parseGrade(grade: string | null | undefined): number {
  const n = Number.parseInt(String(grade ?? ''), 10)
  return Number.isFinite(n) ? n : 0
}

function minutesForSession(s: { duration: number | null; actualTimeSpent: number }): number {
  const v = s.duration ?? s.actualTimeSpent ?? 0
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0
}

/**
 * Build progress report for a student, scoped to calling parent.
 * Verify parentId has access to studentId (parent-student relationship).
 * "This week" = last 7 calendar days from now().
 * Never throws -- returns null on error or access denied.
 */
export async function buildProgressReport(
  parentId: string,
  studentId: string,
): Promise<ParentProgressReport | null> {
  try {
    const [link, student] = await Promise.all([
      prisma.parentStudent.findFirst({
        where: { parentId, studentId, status: 'active' },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          name: true,
          grade: true,
          board: true,
          subjects: true,
          currentStreak: true,
          longestStreak: true,
          level: true,
          totalXp: true,
        },
      }),
    ])

    if (!student) return null
    if (!link) return null

    const weekStart = daysAgoUtcStart(6) // inclusive: today + previous 6 days
    const safetyStart = daysAgoUtcStart(29) // inclusive last 30 calendar days

    const [sessionsThisWeek, questionsAttempted, correctAnswers, safetyFlags, recentSessions] =
      await Promise.all([
        prisma.learningSession.count({
          where: { studentId, startedAt: { gte: weekStart } },
        }),
        prisma.answerEvent.count({
          where: { studentId, createdAt: { gte: weekStart } },
        }),
        prisma.answerEvent.count({
          where: { studentId, createdAt: { gte: weekStart }, isCorrect: true },
        }),
        prisma.safetyEvent.count({
          where: { studentId, createdAt: { gte: safetyStart } },
        }),
        prisma.learningSession.findMany({
          where: { studentId },
          orderBy: { startedAt: 'desc' },
          take: 7,
          select: {
            id: true,
            startedAt: true,
            duration: true,
            actualTimeSpent: true,
          },
        }),
      ])

    const minutesThisWeekRows = await prisma.learningSession.findMany({
      where: { studentId, startedAt: { gte: weekStart } },
      select: { duration: true, actualTimeSpent: true },
    })
    const minutesThisWeek = minutesThisWeekRows.reduce((sum, s) => sum + minutesForSession(s), 0)

    const accuracyPercent =
      questionsAttempted > 0 ? Math.round((correctAnswers / questionsAttempted) * 100) : 0

    // Map subject names -> SubjectDef ids (best-effort, no throws)
    const subjectNames = (student.subjects ?? []).map((s) => String(s)).filter(Boolean)
    const subjectDefs = subjectNames.length
      ? await prisma.subjectDef.findMany({
          where: {
            OR: [{ name: { in: subjectNames } }, { slug: { in: subjectNames } }],
            lifecycle: 'active',
          },
          select: { id: true, name: true },
        })
      : []

    const masteryBySubject: ParentProgressReport['masteryBySubject'] = []
    for (const subj of subjectDefs) {
      const readiness = await computeExamReadiness(studentId, subj.id)
      if (!readiness) continue
      const weak = [...readiness.chapterBreakdown]
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .slice(0, 3)
        .map((c) => ({ chapterName: c.chapterName, avgMastery: c.masteryScore }))

      masteryBySubject.push({
        subjectName: subj.name,
        examReadinessScore: readiness.score,
        readinessLabel: readiness.readinessLabel,
        topWeakChapters: weak,
      })
    }

    const recentActivity: ParentProgressReport['recentActivity'] = []
    for (const s of recentSessions) {
      const [conceptRows, xpAgg] = await Promise.all([
        prisma.answerEvent.findMany({
          where: { sessionId: s.id },
          select: { conceptId: true },
          distinct: ['conceptId'],
        }),
        prisma.studentXP.aggregate({
          where: { sessionId: s.id, studentId },
          _sum: { amount: true },
        }),
      ])

      recentActivity.push({
        date: formatDateShort(s.startedAt),
        durationMinutes: minutesForSession(s),
        conceptsStudied: conceptRows.length,
        xpEarned: xpAgg._sum.amount ?? 0,
      })
    }

    return {
      student: {
        name: student.name ?? 'Student',
        grade: parseGrade(student.grade),
        board: student.board ?? '',
        currentStreak: student.currentStreak ?? 0,
        longestStreak: student.longestStreak ?? 0,
        level: student.level ?? 1,
        totalXp: student.totalXp ?? 0,
      },
      weekSummary: {
        sessionsThisWeek,
        minutesThisWeek,
        questionsAttempted,
        correctAnswers,
        accuracyPercent,
      },
      masteryBySubject,
      recentActivity,
      safetyFlags,
    }
  } catch {
    return null
  }
}

