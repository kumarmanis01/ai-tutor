/**
 * GET /api/student/path
 * Returns the student's learning path as a flat topic list from their LearningPlanItems.
 *
 * Response: { topics: PathTopic[] }  (see app/(student)/student/path/page.tsx)
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

const STATUS_MAP: Record<string, 'upcoming' | 'in_progress' | 'completed' | 'locked'> = {
  UPCOMING: 'upcoming',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DEFERRED: 'locked',
}

export async function GET(_req: Request) {
  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const items = await prisma.learningPlanItem.findMany({
    where: { plan: { studentId: userId } },
    orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
    take: 100,
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
  })

  // completedIds holds concept IDs (not planItem IDs) so prerequisiteConceptIds can be matched
  const completedIds = new Set(
    items.filter((i) => i.status === 'COMPLETED').map((i) => i.concept.id),
  )

  const topics = items.map((item) => {
    const prereqIds: string[] = item.concept.prerequisiteConceptIds ?? []
    const prerequisitesMet =
      prereqIds.length === 0 || prereqIds.every((pid) => completedIds.has(pid))

    // Retrieve per-concept mastery if in progress
    return {
      id: item.id,
      concept: item.concept.name,
      subject: toSubjectKey(item.concept.subject.name),
      status: STATUS_MAP[item.status] ?? 'upcoming',
      prerequisitesMet,
    }
  })

  return NextResponse.json({ topics })
}
