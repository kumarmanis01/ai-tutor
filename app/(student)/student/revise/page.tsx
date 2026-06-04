import { redirect } from 'next/navigation'
import { requireActiveSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SubjectKey } from '@/lib/constants/subjects'
import ReviseClient from './ReviseClient'

function toSubjectKey(name: string): SubjectKey {
  const map: Record<string, SubjectKey> = {
    mathematics: 'math', maths: 'math', math: 'math',
    science: 'science',
    'social science': 'social', social: 'social',
    english: 'english',
    hindi: 'hindi',
  }
  return map[name.toLowerCase()] ?? 'science'
}

function daysLabel(date: Date): string {
  const diff = Math.ceil((date.getTime() - Date.now()) / 86400000)
  if (diff <= 1) return 'Tomorrow'
  if (diff <= 7) return `In ${diff} days`
  return `In ${Math.ceil(diff / 7)} weeks`
}

export default async function RevisePage() {
  const session = await requireActiveSession()
  if (!session) redirect('/login/student')

  const userId = session.user.id
  const now = new Date()
  const sevenDaysOut = new Date(now)
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)

  const [dueItems, upcomingItems] = await Promise.all([
    prisma.studentConceptState.findMany({
      where: { userId, nextReviewAt: { lte: now } },
      orderBy: { nextReviewAt: 'asc' },
      take: 20,
      select: {
        id: true,
        memoryStrength: true,
        nextReviewAt: true,
        concept: { select: { name: true, subject: { select: { name: true } } } },
      },
    }),
    prisma.studentConceptState.findMany({
      where: { userId, nextReviewAt: { gt: now, lte: sevenDaysOut } },
      orderBy: { nextReviewAt: 'asc' },
      take: 20,
      select: {
        id: true,
        memoryStrength: true,
        nextReviewAt: true,
        concept: { select: { name: true, subject: { select: { name: true } } } },
      },
    }),
  ])

  const dueToday = dueItems.map(r => ({
    id: r.id,
    concept: r.concept.name,
    subject: toSubjectKey(r.concept.subject?.name ?? '') as SubjectKey,
    strength: r.memoryStrength ?? 0.5,
  }))

  const upcoming = upcomingItems.map(r => ({
    id: r.id,
    concept: r.concept.name,
    subject: toSubjectKey(r.concept.subject?.name ?? '') as SubjectKey,
    strength: r.memoryStrength ?? 0.5,
    dueLabel: r.nextReviewAt ? daysLabel(r.nextReviewAt) : undefined,
  }))

  return <ReviseClient initialData={{ dueToday, upcoming }} />
}
