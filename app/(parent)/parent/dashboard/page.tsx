/**
 * Parent Dashboard page -- T38
 *
 * Server component: loads all linked children for the parent user,
 * computes per-child readiness scores, passes to ParentDashboard.
 *
 * Route: /parent/dashboard
 *
 * EDIT LOG:
 *   2026-03-08 | claude | original 4-card client-polling dashboard
 *   2026-03-15 | claude | T38 -- rewritten as server component with multi-child view
 *   2026-04-09 | copilot | pass parent/student timezones to ParentDashboard for dual-display
 *   2026-05-04 | copilot | F-PAR-010 AC-02: include examDate per child for exam countdown display
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { AppSession } from '@/lib/types/auth'
import { prisma } from '@/lib/prisma'
import { computeReadinessScore } from '@/lib/student/examReadiness'
import ParentDashboard from '@/components/parent/ParentDashboard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "My Children's Progress | Spinzy",
  description: "See how your children are progressing on Spinzy.",
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

export default async function ParentDashboardPage() {
  const session = (await getServerSession(authOptions)) as AppSession | null
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'parent') redirect('/dashboard')

  const parentId = session.user.id
  const monday = weekStart()

  // 1. Load parent timezone + all linked children in one round-trip each (parallel).
  //    Nested select through ParentStudent avoids the two-step collect-IDs-then-query
  //    pattern which produces an `id: { in: [] }` query when there are no active links.
  const [linkedRows, parent] = await Promise.all([
    prisma.parentStudent.findMany({
      where: { parentId, status: 'active' },
      select: {
        studentId: true,
        student: {
          select: {
            id: true,
            name: true,
            grade: true,
            board: true,
            subjects: true,
            timezone: true,
            accountStatus: true,
            role: true,
            email: true,
            inviteToken: true,
            inviteAcceptedAt: true,
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: parentId }, select: { timezone: true } }),
  ])

  const students = linkedRows.map((r) => r.student)
  const studentIds = linkedRows.map((r) => r.studentId)

  // 2. Fetch streaks, session counts, and exam dates in parallel.
  //    All three queries return empty results cleanly when studentIds is empty.
  const [streaks, sessionCounts, examPlans] = await Promise.all([
    prisma.studentStreak.findMany({
      where: { studentId: { in: studentIds }, kind: 'daily' },
      select: { studentId: true, current: true },
    }),
    prisma.structuredSession.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, startedAt: { gte: monday } },
      _count: { _all: true },
    }),
    // Earliest upcoming examDate per student comes from LearningPlan, not User
    prisma.learningPlan.findMany({
      where: { studentId: { in: studentIds }, examDate: { gt: new Date() } },
      select: { studentId: true, examDate: true },
      orderBy: { examDate: 'asc' },
    }),
  ])

  // Build lookup maps (students array comes from the nested ParentStudent select above)
  const studentMap = new Map(students.map((s) => [s.id, s]))
  const streakMap = new Map(streaks.map((s) => [s.studentId, s.current]))
  const sessionCountMap = new Map(sessionCounts.map((r) => [r.studentId, r._count._all]))
  // First entry per studentId is the earliest upcoming exam (ordered asc above)
  const examDateMap = new Map<string, Date>()
  for (const p of examPlans) {
    if (!examDateMap.has(p.studentId) && p.examDate) {
      examDateMap.set(p.studentId, p.examDate)
    }
  }

  // 3. Resolve all unique subject names → SubjectDef IDs in one query
  const allSubjectNames = [
    ...new Set(
      students.flatMap((s) => (s.subjects as string[]).filter(Boolean))
    ),
  ]
  const subjectDefs = allSubjectNames.length
    ? await prisma.subjectDef.findMany({
        where: {
          lifecycle: 'active',
          OR: [{ name: { in: allSubjectNames } }, { slug: { in: allSubjectNames } }],
        },
        select: { id: true, name: true, slug: true },
      })
    : []

  // Build name/slug → subjectDef map
  const subjectDefByKey = new Map<string, { id: string; name: string }>()
  for (const sd of subjectDefs) {
    subjectDefByKey.set(sd.name, { id: sd.id, name: sd.name })
    if (sd.slug) subjectDefByKey.set(sd.slug, { id: sd.id, name: sd.name })
  }

  // 4. Compute readiness per child sequentially to avoid DB connection bursts
  const children: Array<{
    studentId: string
    name: string
    grade: string
    board: string
    timezone: string | null
    examDate: string | null
    streak: number
    sessionsThisWeek: number
    readiness: Array<{ subjectId: string; subjectName: string; score: number }>
    isPending: boolean
    inviteAccepted: boolean
    hasInviteToken: boolean
    hasEmail: boolean
  }> = []
  for (const studentId of studentIds) {
    const student = studentMap.get(studentId)
    if (!student) continue

    const subjectNames = (student.subjects as string[]).filter(Boolean)
    const resolvedDefs = subjectNames
      .map((n) => subjectDefByKey.get(n))
      .filter((sd): sd is { id: string; name: string } => sd !== undefined)

    const readiness: Array<{ subjectId: string; subjectName: string; score: number }> = []
    for (const sd of resolvedDefs) {
      const result = await computeReadinessScore(studentId, sd.id).catch(() => null)
      readiness.push({ subjectId: sd.id, subjectName: sd.name, score: result?.score ?? 0 })
    }

    const inviteAccepted = Boolean((student as any).inviteAcceptedAt)
    const hasInviteToken = Boolean((student as any).inviteToken)
    // A child is "pending" when they have not yet activated their account
    const isPending = !inviteAccepted && (student.accountStatus === 'pending_onboarding' || student.role === 'user')
    children.push({
      studentId,
      name: student.name ?? 'Student',
      grade: student.grade ?? '',
      board: student.board ?? '',
      timezone: student.timezone ?? null,
      examDate: examDateMap.get(studentId)?.toISOString() ?? null,
      streak: streakMap.get(studentId) ?? 0,
      sessionsThisWeek: sessionCountMap.get(studentId) ?? 0,
      readiness,
      isPending,
      inviteAccepted,
      hasInviteToken,
      hasEmail: Boolean(student.email),
    })
  }

  const validChildren = children.filter(
    (c): c is NonNullable<typeof c> => c !== null,
  )

  const parentTimezone = parent?.timezone ?? null

  return <ParentDashboard parentTimezone={parentTimezone} childrenData={validChildren} />
}
