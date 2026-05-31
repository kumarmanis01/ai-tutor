import { redirect } from 'next/navigation'
import { requireActiveSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SubjectKey } from '@/lib/constants/subjects'
import PathClient from './PathClient'

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

export default async function PathPage() {
  const session = await requireActiveSession()
  if (!session) redirect('/login/student')

  const userId = session.user.id

  const plan = await prisma.learningPlan.findFirst({
    where: { userId },
    select: {
      items: {
        orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
        select: {
          id: true,
          status: true,
          concept: {
            select: {
              id: true,
              name: true,
              prerequisiteConceptIds: true,
              subject: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  const completedIds = new Set(
    (plan?.items ?? [])
      .filter(i => i.status === 'COMPLETED')
      .map(i => i.concept.id)
  )

  const topics = (plan?.items ?? []).map(item => {
    const prereqsMet = item.concept.prerequisiteConceptIds.every(pid => completedIds.has(pid))
    let status: 'upcoming' | 'in_progress' | 'completed' | 'locked' = 'upcoming'
    if (item.status === 'COMPLETED') status = 'completed'
    else if (item.status === 'IN_PROGRESS') status = 'in_progress'
    else if (!prereqsMet) status = 'locked'
    return {
      id: item.id,
      concept: item.concept.name,
      subject: toSubjectKey(item.concept.subject?.name ?? ''),
      status,
      mastery: item.status === 'IN_PROGRESS' ? 50 : undefined,
      prerequisitesMet: prereqsMet,
    }
  })

  return <PathClient initialData={{ topics }} />
}
