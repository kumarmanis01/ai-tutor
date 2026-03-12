import { prisma } from '@/lib/prisma'
import { awardXP } from '@/lib/student/xp'

const BLOOM_MULTIPLIER: Record<string, number> = {
  remember: 1.0,
  understand: 1.2,
  apply: 1.5,
  analyze: 1.8,
  evaluate: 2.0,
  create: 2.2,
}

const DEFAULT_BLOOM_MULTIPLIER = 1.0
const INITIAL_UNLOCK_COUNT = 5
const UNLOCK_ON_COMPLETE_COUNT = 3
const XP_PER_PLAN_ITEM_COMPLETE = 5

/**
 * Build or rebuild the learning plan for a student.
 * Called after diagnostic bootstrap completes.
 *
 * Ordering: chapterWeight * (1 - masteryScore) * bloomMultiplier, sort desc.
 * First 5 items unlocked immediately; rest locked until prerequisites (future).
 * Never throws — returns null on error.
 */
export async function buildLearningPlan(
  studentId: string,
  subjectId: string,
): Promise<{ planId: string; itemCount: number } | null> {
  try {
    const subject = await prisma.subjectDef.findUnique({
      where: { id: subjectId },
      select: { id: true, classId: true },
    })
    if (!subject) return null

    const gradeId = subject.classId

    const concepts = await prisma.concept.findMany({
      where: { subjectId },
      select: {
        id: true,
        name: true,
        bloomLevel: true,
        topicId: true,
        topic: { select: { chapterId: true, chapter: { select: { id: true } } } },
      },
    })

    if (concepts.length === 0) return null

    const chapterIds = [...new Set(concepts.map((c) => c.topic?.chapter?.id).filter(Boolean))] as string[]
    const weights = await prisma.boardChapterWeight.findMany({
      where: { chapterId: { in: chapterIds } },
      select: { chapterId: true, weightMarks: true },
    })
    const weightByChapter = new Map(weights.map((w) => [w.chapterId, w.weightMarks]))

    const states = await prisma.studentConceptState.findMany({
      where: { studentId, conceptId: { in: concepts.map((c) => c.id) } },
      select: { conceptId: true, masteryScore: true },
    })
    const masteryByConcept = new Map(states.map((s) => [s.conceptId, s.masteryScore]))

    const scored = concepts.map((concept) => {
      const chapterId = concept.topic?.chapter?.id
      const chapterWeight = chapterId ? (weightByChapter.get(chapterId) ?? 1) : 1
      const mastery = masteryByConcept.get(concept.id) ?? 0
      const bloom = concept.bloomLevel
        ? (BLOOM_MULTIPLIER[concept.bloomLevel.toLowerCase()] ?? DEFAULT_BLOOM_MULTIPLIER)
        : DEFAULT_BLOOM_MULTIPLIER
      const score = chapterWeight * (1 - mastery) * bloom
      return { concept, score }
    })

    scored.sort((a, b) => b.score - a.score)

    const now = new Date()
    const existing = await prisma.learningPlan.findUnique({
      where: { studentId },
      select: { id: true },
    })

    let planId: string
    if (existing) {
      await prisma.learningPlanItem.deleteMany({ where: { planId: existing.id } })
      planId = existing.id
      await prisma.learningPlan.update({
        where: { id: planId },
        data: { subjectId, gradeId, updatedAt: now },
      })
    } else {
      const created = await prisma.learningPlan.create({
        data: {
          studentId,
          subjectId,
          gradeId,
        },
      })
      planId = created.id
    }

    for (let i = 0; i < scored.length; i++) {
      const unlocked = i < INITIAL_UNLOCK_COUNT ? now : null
      await prisma.learningPlanItem.create({
        data: {
          planId,
          conceptId: scored[i].concept.id,
          orderIndex: i,
          status: 'pending',
          unlockedAt: unlocked,
        },
      })
    }

    return { planId, itemCount: scored.length }
  } catch {
    return null
  }
}

/**
 * Get the next concept the student should study.
 * First LearningPlanItem where status='pending' and unlockedAt IS NOT NULL, order by orderIndex ASC.
 */
export async function getNextConcept(studentId: string): Promise<{
  conceptId: string
  conceptName: string
  chapterName: string
  subjectName: string
  masteryScore: number
} | null> {
  try {
    const plan = await prisma.learningPlan.findUnique({
      where: { studentId },
      select: { id: true },
    })
    if (!plan) return null

    const item = await prisma.learningPlanItem.findFirst({
      where: { planId: plan.id, status: 'pending', unlockedAt: { not: null } },
      orderBy: { orderIndex: 'asc' },
      include: {
        plan: { select: { subjectId: true } },
      },
    })
    if (!item) return null

    const concept = await prisma.concept.findUnique({
      where: { id: item.conceptId },
      select: {
        name: true,
        subjectId: true,
        topicId: true,
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
 * Mark a concept as complete in the plan.
 * Sets status='complete', completedAt=now(). Unlocks next 3 pending items. Awards +5 XP per plan item via awardXP (streak_bonus).
 */
export async function markConceptComplete(studentId: string, conceptId: string): Promise<void> {
  try {
    const plan = await prisma.learningPlan.findUnique({
      where: { studentId },
      select: { id: true },
    })
    if (!plan) return

    const item = await prisma.learningPlanItem.findFirst({
      where: { planId: plan.id, conceptId },
    })
    if (!item) return

    const now = new Date()
    await prisma.learningPlanItem.update({
      where: { id: item.id },
      data: { status: 'complete', completedAt: now },
    })

    const nextPending = await prisma.learningPlanItem.findMany({
      where: { planId: plan.id, status: 'pending', unlockedAt: null },
      orderBy: { orderIndex: 'asc' },
      take: UNLOCK_ON_COMPLETE_COUNT,
      select: { id: true },
    })
    for (const next of nextPending) {
      await prisma.learningPlanItem.update({
        where: { id: next.id },
        data: { unlockedAt: now },
      })
    }

    void awardXP({
      studentId,
      amount: XP_PER_PLAN_ITEM_COMPLETE,
      source: 'streak_bonus',
    })
  } catch {
    // never throws
  }
}
