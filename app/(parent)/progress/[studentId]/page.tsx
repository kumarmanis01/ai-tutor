/**
 * Parent → Child progress detail page (T39)
 *
 * Server component. Parent role required.
 * Verifies the studentId is actually linked to this parent.
 * NO session transcript access -- no message content loaded.
 * Computes anonymous peer percentile per subject for benchmarking toggle (F-PAR-011 AC-04).
 *
 * Route: /parent/progress/[studentId]
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | original T39 server component
 * - 2026-05-04T00:00:00Z | copilot | F-PAR-011 AC-04: compute peerPercentile per subject
 */

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { AppSession } from '@/lib/types/auth'
import { prisma } from '@/lib/prisma'
import { computeReadinessScore } from '@/lib/student/examReadiness'
import ParentProgressDetail from '@/components/parent/ParentProgressDetail'
import { getNextConcept } from '@/lib/student/learningPlan'

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

  // ── Learning plan summary (F-PAR-002 AC-03: read-only view for parent) ──
  const [latestPlan, nextConcept] = await Promise.all([
    prisma.learningPlan.findFirst({
      where: { studentId },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        subjectId: true,
        _count: { select: { items: true } },
      },
    }),
    getNextConcept(studentId).catch(() => null),
  ])

  let learningPlan = null
  if (latestPlan) {
    const [completedCount, subjectDef] = await Promise.all([
      prisma.learningPlanItem.count({ where: { planId: latestPlan.id, status: 'COMPLETED' } }),
      prisma.subjectDef.findUnique({ where: { id: latestPlan.subjectId }, select: { name: true } }),
    ])
    const totalConcepts = latestPlan._count.items
    learningPlan = {
      subjectName: subjectDef?.name ?? '',
      totalConcepts,
      completedConcepts: completedCount,
      progressPercent: totalConcepts > 0 ? Math.round((completedCount / totalConcepts) * 100) : 0,
      nextConceptName: nextConcept?.conceptName ?? null,
    }
  }

  // ── Readiness per subject ──────────────────────────────────────────────
  const readiness: Array<{ subjectId: string; subjectName: string; score: number; peerPercentile: number | null }> = []
  for (const sd of subjectDefs) {
    const r = await computeReadinessScore(studentId, sd.id).catch(() => null)
    readiness.push({ subjectId: sd.id, subjectName: sd.name, score: r?.score ?? 0, peerPercentile: null })
  }

  // ── Anonymous peer benchmarking (F-PAR-011 AC-04) ─────────────────────
  // Compute peer percentile per subject using StudentTopicMastery in one batch query.
  // "peer percentile" = % of same-grade students on the platform with lower avg accuracy.
  if (student.grade && readiness.length > 0) {
    const subjectNames = readiness.map((r) => r.subjectName)
    const peers = await prisma.studentTopicMastery.groupBy({
      by: ['subject', 'studentId'],
      where: { subject: { in: subjectNames }, student: { grade: student.grade } },
      _avg: { accuracy: true },
    }).catch(() => null)

    if (peers && peers.length > 0) {
      // Group peer averages by subject
      const peersBySubject = new Map<string, number[]>()
      for (const p of peers) {
        const arr = peersBySubject.get(p.subject) ?? []
        arr.push(p._avg.accuracy ?? 0)
        peersBySubject.set(p.subject, arr)
      }
      // Compute percentile for the student (student is included in the query, so exclude self)
      const studentMasteries = await prisma.studentTopicMastery.groupBy({
        by: ['subject'],
        where: { studentId, subject: { in: subjectNames } },
        _avg: { accuracy: true },
      }).catch(() => null)
      const studentAvgBySubject = new Map<string, number>(
        (studentMasteries ?? []).map((r: any) => [r.subject, r._avg.accuracy ?? 0])
      )
      for (const row of readiness) {
        const studentAvg = studentAvgBySubject.get(row.subjectName) ?? 0
        const arr = peersBySubject.get(row.subjectName) ?? []
        // Exclude this student from the denominator to avoid counting self
        const others = arr.filter((_, _i) => true) // all entries (already grouped by studentId)
        if (others.length > 1) {
          const below = others.filter((a) => a < studentAvg).length
          row.peerPercentile = Math.round((below / (others.length - 1)) * 100)
        }
      }
    }
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
  const topicIds = Array.from(new Set(recentSessions.map((s: any) => s.topicId).filter(Boolean)))
  const progresses = topicIds.length
    ? await prisma.studentTopicProgress.findMany({
        where: { studentId, topicId: { in: topicIds } },
        select: { topicId: true, mastery: true, lastStudiedAt: true },
      })
    : []
  const progressMap = new Map<string, any>(progresses.map((p: any) => [p.topicId, p]))

  // ── Format the last-10 sessions for the component (no transcript) ──────
  const formattedSessions = recentSessions.map((s: any) => ({
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
      learningPlan={learningPlan}
    />
  )
}
