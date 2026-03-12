import { prisma } from '@/lib/prisma'

const MS_PER_DAY = 86400000

/**
 * Returns the next scheduled review (nextReviewAt > now), if any.
 * Used for "all caught up" empty state to show when the next review is.
 */
export async function getNextUpcomingReview(studentId: string): Promise<{
  conceptName: string
  nextReviewAt: Date
  daysUntil: number
} | null> {
  const now = new Date()
  const state = await prisma.studentConceptState.findFirst({
    where: {
      studentId,
      nextReviewAt: { gt: now },
    },
    orderBy: { nextReviewAt: 'asc' },
    select: { nextReviewAt: true, conceptId: true },
  })
  if (!state?.nextReviewAt) return null
  const concept = await prisma.concept.findUnique({
    where: { id: state.conceptId },
    select: { name: true },
  })
  const daysUntil = Math.max(0, Math.ceil((state.nextReviewAt.getTime() - now.getTime()) / MS_PER_DAY))
  return {
    conceptName: concept?.name ?? 'Unknown',
    nextReviewAt: state.nextReviewAt,
    daysUntil,
  }
}
