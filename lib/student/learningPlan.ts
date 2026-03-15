import { prisma } from '@/lib/prisma'
import { awardXP } from '@/lib/student/xp'

const XP_PER_PLAN_ITEM_COMPLETE = 5

/**
 * Get the next concept the student should study.
 * First UPCOMING LearningPlanItem in week/order sequence.
 * Returns null if no plan or no items remaining.
 */
export async function getNextConcept(studentId: string): Promise<{
  conceptId: string
  conceptName: string
  chapterName: string
  subjectName: string
  masteryScore: number
} | null> {
  try {
    const plan = await prisma.learningPlan.findFirst({
      where: { studentId },
      orderBy: { generatedAt: 'desc' },
      select: { id: true },
    })
    if (!plan) return null

    const item = await prisma.learningPlanItem.findFirst({
      where: { planId: plan.id, status: 'UPCOMING' },
      orderBy: [{ weekNumber: 'asc' }, { orderInWeek: 'asc' }],
    })
    if (!item) return null

    const concept = await prisma.concept.findUnique({
      where: { id: item.conceptId },
      select: {
        name: true,
        subjectId: true,
        topic: { select: { chapter: { select: { name: true } } } },
      },
    })
    if (!concept) return null

    const subject = await prisma.subjectDef.findUnique({
      where: { id: concept.subjectId },
      select: { name: true },
    })

    const state = await prisma.studentConceptState.findUnique({
      where: { studentId_conceptId: { studentId, conceptId: item.conceptId } },
      select: { masteryScore: true },
    })

    return {
      conceptId: item.conceptId,
      conceptName: concept.name,
      chapterName: concept.topic?.chapter?.name ?? '',
      subjectName: subject?.name ?? '',
      masteryScore: state?.masteryScore ?? 0,
    }
  } catch {
    return null
  }
}

/**
 * Mark a concept as COMPLETED in the plan. Awards +5 XP.
 */
export async function markConceptComplete(studentId: string, conceptId: string): Promise<void> {
  try {
    const plan = await prisma.learningPlan.findFirst({
      where: { studentId },
      orderBy: { generatedAt: 'desc' },
      select: { id: true },
    })
    if (!plan) return

    const item = await prisma.learningPlanItem.findFirst({
      where: { planId: plan.id, conceptId },
    })
    if (!item) return

    await prisma.learningPlanItem.update({
      where: { id: item.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })

    void awardXP({
      studentId,
      amount: XP_PER_PLAN_ITEM_COMPLETE,
      source: 'streak_bonus',
    })
  } catch {
    // never throws
  }
}

/**
 * Thin wrapper kept for backward compatibility.
 * New code should use generateLearningPlan from lib/ai/learningPlan.
 */
export async function buildLearningPlan(
  studentId: string,
  subjectId: string,
): Promise<{ planId: string; itemCount: number } | null> {
  const { generateLearningPlan } = await import('@/lib/ai/learningPlan')
  const planId = await generateLearningPlan(studentId, subjectId)
  if (!planId) return null
  const itemCount = await prisma.learningPlanItem.count({ where: { planId } })
  return { planId, itemCount }
}
