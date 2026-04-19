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

  // 30-day heatmap + last-10 sessions
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)

  // ── Load student data, recent sessions (30d for heatmap + last 10 for list), and subjects ──
  const [student, sessions30, recentSessions, subjectDefs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { name: true, grade: true, board: true, subjects: true },
    }),
    // Sessions in the last 30 days (for heatmap)
    prisma.structuredSession.findMany({
      where: { studentId, startedAt: { gte: thirtyDaysAgo } },
      select: { startedAt: true },
      orderBy: { startedAt: 'desc' },
      take: 500,
    }),
    // Last 10 sessions for the recent activity list (no transcript content)
    prisma.structuredSession.findMany({
      where: { studentId },
      select: {
        id: true,
        startedAt: true,
        completedAt: true,
        state: true,
        topicId: true,
        topic: { select: { name: true, chapter: { select: { name: true, subject: { select: { name: true } } } } } },
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
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
  const readiness: Array<{ subjectId: string; subjectName: string; score: number }> = []
  for (const sd of subjectDefs) {
    const r = await computeReadinessScore(studentId, sd.id).catch(() => null)
    readiness.push({ subjectId: sd.id, subjectName: sd.name, score: r?.score ?? 0 })
  }

  // ── Build heatmap counts (30 days) ───────────────────────────────────
  const countByDate: Record<string, number> = {}
  for (const s of sessions30) {
    const key = s.startedAt.toISOString().split('T')[0]
    countByDate[key] = (countByDate[key] ?? 0) + 1
  }

  const now = new Date()
  const heatmapDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    d.setUTCDate(d.getUTCDate() - (29 - i))
    const key = d.toISOString().split('T')[0]
    return { date: key, count: countByDate[key] ?? 0 }
  })

  // ── Resolve per-topic progress for the recent sessions (used to surface a mastery indicator) ──
  const topicIds = Array.from(new Set(recentSessions.map((s) => s.topicId).filter(Boolean)))
  const progresses = topicIds.length
    ? await prisma.studentTopicProgress.findMany({
        where: { studentId, topicId: { in: topicIds } },
        select: { topicId: true, mastery: true, lastStudiedAt: true },
      })
    : []
  const progressMap = new Map(progresses.map((p) => [p.topicId, p]))

  // ── Format the last-10 sessions for the component (no transcript) ──────
  const formattedSessions = recentSessions.map((s) => ({
    id: s.id,
    date: s.startedAt.toISOString(),
    topicId: s.topicId,
    topicName: s.topic?.name ?? '',
    subjectName: s.topic?.chapter?.subject?.name ?? '',
    chapterName: s.topic?.chapter?.name ?? '',
    durationMinutes: s.completedAt
      ? Math.round((s.completedAt.getTime() - s.startedAt.getTime()) / 60_000)
      : null,
    completed: s.state === 'COMPLETE',
    masteryAfter: progressMap.get(s.topicId as string)?.mastery ?? null,
  }))

  return (
    <ParentProgressDetail
      studentName={student.name ?? 'Student'}
      grade={student.grade ?? ''}
      board={student.board ?? ''}
      sessions={formattedSessions}
      readiness={readiness}
      heatmapDays={heatmapDays}
    />
  )
}
