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

  // 1. Load all active child links
  const links = await prisma.parentStudent.findMany({
    where: { parentId, status: 'active' },
    select: { studentId: true },
  })

  // 2. Per-child data (parallel)
  const children = await Promise.all(
    links.map(async ({ studentId }) => {
      const [student, streak, sessionsThisWeek] = await Promise.all([
        prisma.user.findUnique({
          where: { id: studentId },
          select: { name: true, grade: true, board: true, subjects: true },
        }),
        prisma.studentStreak.findFirst({
          where: { studentId, kind: 'daily' },
          select: { current: true },
        }),
        prisma.structuredSession.count({
          where: { studentId, startedAt: { gte: monday } },
        }),
      ])

      if (!student) return null

      // 3. Resolve subject names → SubjectDef IDs → readiness
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

      const readiness = await Promise.all(
        subjectDefs.map(async (sd) => {
          const result = await computeReadinessScore(studentId, sd.id).catch(() => null)
          return { subjectId: sd.id, subjectName: sd.name, score: result?.score ?? 0 }
        }),
      )

      return {
        studentId,
        name: student.name ?? 'Student',
        grade: student.grade ?? '',
        board: student.board ?? '',
        streak: streak?.current ?? 0,
        sessionsThisWeek,
        readiness,
      }
    }),
  )

  const validChildren = children.filter(
    (c): c is NonNullable<typeof c> => c !== null,
  )

  return <ParentDashboard children={validChildren} />
}
