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

  // 1. Load all active child links + parent timezone in parallel
  const [links, parent] = await Promise.all([
    prisma.parentStudent.findMany({
      where: { parentId, status: 'active' },
      select: { studentId: true },
    }),
    prisma.user.findUnique({ where: { id: parentId }, select: { timezone: true } }),
  ])

  const studentIds = links.map((l) => l.studentId)

  // 2. Batch-load all student profiles, streaks, and session counts in parallel
  const [students, streaks, sessionCounts] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true, grade: true, board: true, subjects: true, timezone: true },
    }),
    prisma.studentStreak.findMany({
      where: { studentId: { in: studentIds }, kind: 'daily' },
      select: { studentId: true, current: true },
    }),
    prisma.structuredSession.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, startedAt: { gte: monday } },
      _count: { _all: true },
    }),
  ])

  // Build lookup maps
  const studentMap = new Map(students.map((s) => [s.id, s]))
  const streakMap = new Map(streaks.map((s) => [s.studentId, s.current]))
  const sessionCountMap = new Map(sessionCounts.map((r) => [r.studentId, r._count._all]))

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

  // 4. Compute readiness per child in parallel (each child's subjects are parallel too)
  const children = await Promise.all(
    studentIds.map(async (studentId) => {
      const student = studentMap.get(studentId)
      if (!student) return null

      const subjectNames = (student.subjects as string[]).filter(Boolean)
      const resolvedDefs = subjectNames
        .map((n) => subjectDefByKey.get(n))
        .filter((sd): sd is { id: string; name: string } => sd !== undefined)

      const readiness = await Promise.all(
        resolvedDefs.map(async (sd) => {
          const result = await computeReadinessScore(studentId, sd.id).catch(() => null)
          return { subjectId: sd.id, subjectName: sd.name, score: result?.score ?? 0 }
        }),
      )

      return {
        studentId,
        name: student.name ?? 'Student',
        grade: student.grade ?? '',
        board: student.board ?? '',
        timezone: student.timezone ?? null,
        streak: streakMap.get(studentId) ?? 0,
        sessionsThisWeek: sessionCountMap.get(studentId) ?? 0,
        readiness,
      }
    }),
  )

  const validChildren = children.filter(
    (c): c is NonNullable<typeof c> => c !== null,
  )

  const parentTimezone = parent?.timezone ?? null

  return <ParentDashboard children={validChildren} parentTimezone={parentTimezone} />
}
