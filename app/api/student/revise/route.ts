/**
 * GET /api/student/revise
 * Returns spaced-repetition revision queue for the new revisions screen.
 *
 * Response: { dueToday: RevisionTopic[], upcoming: RevisionTopic[] }
 * (see app/(student)/student/revise/page.tsx)
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'
import type { SubjectKey } from '@/lib/constants/subjects'

export const dynamic = 'force-dynamic'

function toSubjectKey(name: string): SubjectKey {
  const n = name.toLowerCase()
  if (n.includes('math')) return 'math'
  if (n.includes('science') && !n.includes('social')) return 'science'
  if (n.includes('social')) return 'social'
  if (n.includes('english')) return 'english'
  if (n.includes('hindi')) return 'hindi'
  return n as SubjectKey
}

export async function GET(_req: Request) {
  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const [dueStates, upcomingStates] = await Promise.all([
    prisma.studentConceptState.findMany({
      where: { studentId: userId, nextReviewAt: { lte: now } },
      orderBy: { nextReviewAt: 'asc' },
      take: 20,
      select: {
        id: true,
        memoryStrength: true,
        concept: {
          select: {
            name: true,
            subject: { select: { name: true } },
          },
        },
      },
    }),
    prisma.studentConceptState.findMany({
      where: { studentId: userId, nextReviewAt: { gt: now } },
      orderBy: { nextReviewAt: 'asc' },
      take: 15,
      select: {
        id: true,
        memoryStrength: true,
        nextReviewAt: true,
        concept: {
          select: {
            name: true,
            subject: { select: { name: true } },
          },
        },
      },
    }),
  ])

  const dueToday = dueStates.map((s) => ({
    id: s.id,
    concept: s.concept.name,
    subject: toSubjectKey(s.concept.subject.name),
    strength: s.memoryStrength ?? 0,
  }))

  const upcoming = upcomingStates.map((s) => {
    const daysUntil = s.nextReviewAt
      ? Math.ceil((s.nextReviewAt.getTime() - now.getTime()) / 86_400_000)
      : 0
    const dueLabel =
      daysUntil === 0
        ? 'Today'
        : daysUntil === 1
          ? 'Tomorrow'
          : `In ${daysUntil} days`
    return {
      id: s.id,
      concept: s.concept.name,
      subject: toSubjectKey(s.concept.subject.name),
      strength: s.memoryStrength ?? 0,
      dueLabel,
    }
  })

  return NextResponse.json({ dueToday, upcoming })
}
