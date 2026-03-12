import { prisma } from '@/lib/prisma'

const BASELINE_MASTERY = 0.3

export interface ExamReadinessResult {
  score: number
  readinessLabel: 'Needs Work' | 'Developing' | 'On Track' | 'Exam Ready'
  chapterBreakdown: Array<{
    chapterName: string
    weightMarks: number
    masteryScore: number
    weightedContribution: number
  }>
  totalMarks: number
  conceptsCovered: number
  totalConcepts: number
}

/**
 * Pure helper — exported for tests.
 */
export function computeReadinessLabel(score: number): ExamReadinessResult['readinessLabel'] {
  if (score < 40) return 'Needs Work'
  if (score < 60) return 'Developing'
  if (score < 80) return 'On Track'
  return 'Exam Ready'
}

/**
 * Pure helper — exported for tests.
 * weightedContribution = avgMastery * (weightMarks / totalMarks) * 100
 */
export function computeWeightedContribution(
  avgMastery: number,
  weightMarks: number,
  totalMarks: number,
): number {
  if (totalMarks <= 0) return 0
  return avgMastery * (weightMarks / totalMarks) * 100
}

/**
 * Compute exam readiness for a student + subject.
 * Weights each chapter's mastery by BoardChapterWeight. Never throws — returns null on error.
 */
export async function computeExamReadiness(
  studentId: string,
  subjectId: string,
): Promise<ExamReadinessResult | null> {
  try {
    const concepts = await prisma.concept.findMany({
      where: { subjectId },
      select: {
        id: true,
        topicId: true,
        topic: { select: { chapterId: true, chapter: { select: { id: true, name: true } } } },
      },
    })

    if (concepts.length === 0) return null

    const conceptIds = concepts.map((c) => c.id)
    const [states, weights] = await Promise.all([
      prisma.studentConceptState.findMany({
        where: { studentId, conceptId: { in: conceptIds } },
        select: { conceptId: true, masteryScore: true },
      }),
      prisma.boardChapterWeight.findMany({
        where: {
          chapter: { subjectId },
        },
        select: { chapterId: true, weightMarks: true },
      }),
    ])

    const masteryByConcept = new Map(states.map((s) => [s.conceptId, s.masteryScore]))
    const weightByChapter = new Map(weights.map((w) => [w.chapterId, w.weightMarks]))

    const totalMarks = weights.reduce((sum, w) => sum + w.weightMarks, 0)
    if (totalMarks <= 0) {
      return {
        score: 0,
        readinessLabel: 'Needs Work',
        chapterBreakdown: [],
        totalMarks: 0,
        conceptsCovered: 0,
        totalConcepts: concepts.length,
      }
    }

    const conceptsByChapter = new Map<string, { chapterName: string; conceptIds: string[] }>()
    for (const c of concepts) {
      const chapterId = c.topic?.chapter?.id
      const chapterName = c.topic?.chapter?.name ?? 'Unknown'
      if (!chapterId) continue
      if (!conceptsByChapter.has(chapterId)) {
        conceptsByChapter.set(chapterId, { chapterName, conceptIds: [] })
      }
      conceptsByChapter.get(chapterId)!.conceptIds.push(c.id)
    }

    const chapterBreakdown: ExamReadinessResult['chapterBreakdown'] = []
    let scoreSum = 0

    for (const [chapterId, { chapterName, conceptIds: cIds }] of conceptsByChapter) {
      const weightMarks = weightByChapter.get(chapterId) ?? 0
      const masteries = cIds.map((cid) => masteryByConcept.get(cid) ?? BASELINE_MASTERY)
      const avgMastery = masteries.length > 0 ? masteries.reduce((a, b) => a + b, 0) / masteries.length : 0
      const weightedContribution = computeWeightedContribution(avgMastery, weightMarks, totalMarks)
      scoreSum += weightedContribution
      chapterBreakdown.push({
        chapterName,
        weightMarks,
        masteryScore: Math.round(avgMastery * 1000) / 1000,
        weightedContribution: Math.round(weightedContribution * 1000) / 1000,
      })
    }

    const score = Math.round(scoreSum * 10) / 10
    const conceptsCovered = concepts.filter((c) => (masteryByConcept.get(c.id) ?? BASELINE_MASTERY) > 0.4).length

    return {
      score,
      readinessLabel: computeReadinessLabel(score),
      chapterBreakdown,
      totalMarks,
      conceptsCovered,
      totalConcepts: concepts.length,
    }
  } catch {
    return null
  }
}
