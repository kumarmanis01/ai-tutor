/**
 * Parent → Child progress detail page (T39)
 *
 * Server component. Parent role required.
 * Verifies the studentId is actually linked to this parent.
 * NO session transcript access -- no message content loaded.
 *
 * Route: /parent/progress/[studentId]
 */

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { AppSession } from '@/lib/types/auth'
import { prisma } from '@/lib/prisma'
import { computeReadinessScore } from '@/lib/student/examReadiness'
import ParentProgressDetail from '@/components/parent/ParentProgressDetail'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Progress Report | Spinzy',
}

export default async function ParentProgressDetailPage({
  params,
}: {
  params: { studentId: string }
}) {
  const { studentId } = params
  const session = (await getServerSession(authOptions)) as AppSession | null

  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'parent') redirect('/dashboard')

  const parentId = session.user.id

  // ── Verify parent-student link ─────────────────────────────────────────
  const link = await prisma.parentStudent.findUnique({
    where: { parentId_studentId: { parentId, studentId } },
    select: { status: true },
  })
  if (!link || link.status !== 'active') notFound()

  const _monday = (() => {
    const now = new Date()
    const dow = now.getUTCDay()
    const d = new Date(now)
    d.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1))
    d.setUTCHours(0, 0, 0, 0)
    return d
  })()

  // ── Load student data (no transcript content) ──────────────────────────
  const [student, sessions, subjectDefs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { name: true, grade: true, board: true, subjects: true },
    }),
    // Sessions last 7 days -- NO message/transcript fields
    prisma.structuredSession.findMany({
      where: {
        studentId,
        startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        state: true,
        topic: { select: { name: true, chapter: { select: { name: true, subject: { select: { name: true } } } } } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    }),
    // resolve subjects
    (async () => {
      const s = await prisma.user.findUnique({
        where: { id: studentId },
        select: { subjects: true },
      })
      const names = ((s?.subjects ?? []) as string[]).filter(Boolean)
      if (!names.length) return []
      return prisma.subjectDef.findMany({
        where: {
          lifecycle: 'active',
          OR: [{ name: { in: names } }, { slug: { in: names } }],
        },
        select: { id: true, name: true },
      })
    })(),
  ])

  if (!student) notFound()

  // ── Readiness per subject ──────────────────────────────────────────────
  const readiness = await Promise.all(
    subjectDefs.map(async (sd) => {
      const r = await computeReadinessScore(studentId, sd.id).catch(() => null)
      return { subjectId: sd.id, subjectName: sd.name, score: r?.score ?? 0 }
    }),
  )

  // ── Format sessions for component (no transcript) ──────────────────────
  const formattedSessions = sessions.map((s) => ({
    id: s.id,
    date: s.startedAt.toISOString(),
    topicName: s.topic?.name ?? '',
    subjectName: s.topic?.chapter?.subject?.name ?? '',
    chapterName: s.topic?.chapter?.name ?? '',
    durationMinutes: s.completedAt
      ? Math.round((s.completedAt.getTime() - s.startedAt.getTime()) / 60_000)
      : null,
    completed: s.state === 'COMPLETE',
  }))

  return (
    <ParentProgressDetail
      studentName={student.name ?? 'Student'}
      grade={student.grade ?? ''}
      board={student.board ?? ''}
      sessions={formattedSessions}
      readiness={readiness}
    />
  )
}
