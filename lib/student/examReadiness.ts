/**
 * FILE OBJECTIVE:
 * - Compute student exam readiness and predicted score ranges based on
 *   chapter-weighted mastery and recent mock performance.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/examReadiness.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T12:30:00Z | copilot | allow passing `lastMock` via asserted options object to avoid TS excess-property error
 */

import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

const BASELINE_MASTERY = 0.3
const READINESS_CACHE_TTL = 3600 // 1 hour

// ── New typed result shape (Domain 7 §7.8) ───────────────────────────────────

export type ReadinessLabel = 'critical' | 'needs_work' | 'on_track' | 'ready'

export interface ReadinessChapter {
  chapterId: string
  chapterName: string
  masteryScore: number   // 0-1 float, 0 if no student data
  boardWeightPct: number // chapter weight as % of total exam marks
  contribution: number   // masteryScore × boardWeightPct (0-100 scale)
  status: ReadinessLabel
}

export interface ReadinessResult {
  score: number             // 0-100 integer
  label: ReadinessLabel
  chapters: ReadinessChapter[]
  predictedRange?: PredictedScoreRange
}

export interface PredictedScoreRange {
  low: number
  high: number
  confidenceLevel: number // e.g. 95 for 95% CI
  daysUsed?: number | null
}

function readinessLabel(score: number): ReadinessLabel {
  if (score < 40) return 'critical'
  if (score < 70) return 'needs_work'
  if (score < 90) return 'on_track'
  return 'ready'
}

/**
 * Compute exam readiness for a student + subject using chapter-weighted mastery.
 *
 * Algorithm:
 * - avgMastery per chapter = mean(StudentConceptState.masteryScore) for that chapter
 *   If no states → avgMastery = 0 (no BASELINE fallback; honest zero for untouched chapters)
 * - contribution = avgMastery × (weightMarks / totalWeightMarks) × 100
 * - score = Math.round(sum(contributions))  → integer 0-100
 *
 * Caches result in Redis (TTL 3600s). Never throws -- returns zero-state on error.
 */
export async function computeReadinessScore(
  studentId: string,
  subjectId: string,
): Promise<ReadinessResult> {
  const zero: ReadinessResult = { score: 0, label: 'critical', chapters: [] }

  // 1. Try cache first
  const cacheKey = `readiness:${studentId}:${subjectId}`
  try {
    const redis = getRedis()
    if (redis) {
      const cached = await redis.get(cacheKey)
      if (cached) return JSON.parse(cached) as ReadinessResult
    }
  } catch {
    // cache miss -- continue to compute
  }

  try {
    // 2. Load all concepts grouped by chapter for this subject
    const chapters = await prisma.chapterDef.findMany({
      where: { subject: { id: subjectId } },
      select: {
        id: true,
        name: true,
        boardChapterWeights: { select: { weightMarks: true } },
        topics: {
          select: {
            concepts: {
              select: { id: true },
            },
          },
        },
      },
    })

    if (chapters.length === 0) return zero

    const totalWeightMarks = chapters.reduce(
      (sum, ch) => sum + (ch.boardChapterWeights[0]?.weightMarks ?? 0),
      0,
    )
    if (totalWeightMarks <= 0) return zero

    // 3. Gather all concept IDs for a single bulk state fetch
    const allConceptIds = chapters.flatMap((ch) =>
      ch.topics.flatMap((t) => t.concepts.map((c) => c.id)),
    )
    if (allConceptIds.length === 0) return zero

    const states = await prisma.studentConceptState.findMany({
      where: { studentId, conceptId: { in: allConceptIds } },
      select: { conceptId: true, masteryScore: true, retention: true },
    })
    const masteryMap = new Map<string, number>(
      states.map((s) => [s.conceptId, s.masteryScore]),
    )

    // 4. Compute per-chapter contribution
    let scoreSum = 0
    const chapterBreakdown: ReadinessChapter[] = []

    for (const ch of chapters) {
      const weightMarks = ch.boardChapterWeights[0]?.weightMarks ?? 0
      const conceptIds = ch.topics.flatMap((t) => t.concepts.map((c) => c.id))
      const masteries = conceptIds.map((id) => masteryMap.get(id) ?? 0)
      const avgMastery =
        masteries.length > 0
          ? masteries.reduce((a, b) => a + b, 0) / masteries.length
          : 0
      const boardWeightPct = (weightMarks / totalWeightMarks) * 100
      const contribution = avgMastery * boardWeightPct

      scoreSum += contribution
      chapterBreakdown.push({
        chapterId: ch.id,
        chapterName: ch.name,
        masteryScore: Math.round(avgMastery * 1000) / 1000,
        boardWeightPct: Math.round(boardWeightPct * 10) / 10,
        contribution: Math.round(contribution * 10) / 10,
        status: readinessLabel(Math.round(avgMastery * 100)),
      })
    }

    const score = Math.round(scoreSum)
    const result: ReadinessResult = {
      score,
      label: readinessLabel(score),
      chapters: chapterBreakdown,
    }

    // 5. Compute predicted range using available signals (states + recent mock)
    try {
      const signalStates = states.map((s) => ({ conceptId: s.conceptId, retention: (s as any).retention }))
      let lastMock: { finishedAt?: Date; scorePercent?: number } | undefined = undefined
      try {
        const m = await prisma.mockExamAttempt.findFirst({
          where: { studentId, mockExam: { subjectId }, finishedAt: { not: null } },
          orderBy: { finishedAt: 'desc' },
          select: { finishedAt: true, scorePercent: true },
        })
        if (m && m.finishedAt) lastMock = { finishedAt: m.finishedAt, scorePercent: m.scorePercent ?? undefined }
      } catch {
        // ignore mock lookup failures
      }

      // Build an options object and assert its type to avoid excess-property
      // checks when passing `lastMock` into `computePredictedScoreRange`.
      const _predictedOpts = ({ states: signalStates, lastMock, daysToExam: null } as unknown) as Parameters<typeof computePredictedScoreRange>[1]
      result.predictedRange = computePredictedScoreRange(result, _predictedOpts)
    } catch {
      // non-fatal; keep result without predictedRange
    }

    // 6. Write to cache (fire-and-forget)
    try {
      const redis = getRedis()
      if (redis) {
        void redis.set(cacheKey, JSON.stringify(result), 'EX', READINESS_CACHE_TTL)
      }
    } catch {
      // non-fatal
    }

    return result
  } catch {
    return zero
  }
}

/**
 * Compute a simple predicted score range (confidence interval) around the
 * readiness `score` using the chapter contribution dispersion as a proxy for
 * uncertainty. The interval is scaled by `daysToExam` so that confidence
 * narrows as the exam approaches (smaller days -> narrower interval).
 *
 * This is intentionally conservative and deterministic (no external AI call).
 */
export function computePredictedScoreRange(
  readiness: ReadinessResult,
  opts?:
    | number
    | {
        daysToExam?: number | null
        states?: Array<{ conceptId: string; retention?: number }>
        studentId?: string
        subjectId?: string
        lastMock?: { finishedAt?: Date; scorePercent?: number }
      },
): PredictedScoreRange {
  // Backwards-compatible: allow number as daysToExam
  let daysToExam: number | null | undefined = undefined
  let states: Array<{ conceptId: string; retention?: number }> | undefined = undefined
  let _studentId: string | undefined = undefined
  let _subjectId: string | undefined = undefined
  let lastMock: { finishedAt?: Date; scorePercent?: number } | undefined = undefined
  if (typeof opts === 'number') {
    daysToExam = opts
  } else if (opts && typeof opts === 'object') {
    daysToExam = opts.daysToExam
    states = opts.states
    _studentId = opts.studentId
    _subjectId = opts.subjectId
    // support passing a lastMock object directly
    ;(lastMock as any) = (opts as any).lastMock
  }

  const score = Math.max(0, Math.min(100, Math.round(readiness.score)))
  const contribs = (readiness.chapters || []).map((c) => Number(c.contribution ?? 0))
  const n = Math.max(0, contribs.length)

  // Fallback small window when we don't have enough granularity
  if (n <= 1) {
    const delta = 6
    return { low: Math.max(0, score - delta), high: Math.min(100, score + delta), confidenceLevel: 80, daysUsed: daysToExam ?? null }
  }

  const mean = contribs.reduce((a, b) => a + b, 0) / n
  const variance = contribs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n
  const sdContrib = Math.sqrt(variance)

  // Approximate SD of the sum of contributions: sd_sum = sd_contrib * sqrt(n)
  let sdSum = sdContrib * Math.sqrt(n)

  const z = 1.96 // 95% CI

  // Scale CI by time horizon: farther exams -> wider CI. Clamp to [0.25, 1]
  let scale = 1
  if (typeof daysToExam === 'number' && daysToExam !== null) {
    scale = Math.max(0.25, Math.min(1, daysToExam / 90))
  }

  // Incorporate spaced-repetition retention if provided via states
  if (states && states.length > 0) {
    const retentionVals = states.map((s) => Math.max(0, Math.min(2, Number(s.retention ?? 1))))
    const avgRetention = retentionVals.reduce((a, b) => a + b, 0) / retentionVals.length
    // If avgRetention < 1 → more uncertainty; >1 → a bit more confident
    const retentionAdj = 1 - (avgRetention - 1) * 0.4 // small effect
    sdSum = sdSum * Math.max(0.7, Math.min(1.3, 1 / retentionAdj))
  }

  // Incorporate last mock exam recency and score if provided in opts
  if (lastMock && lastMock.finishedAt && typeof lastMock.scorePercent === 'number') {
    const daysSince = Math.max(0, Math.ceil((Date.now() - lastMock.finishedAt.getTime()) / 86_400_000))
    const recencyWeight = Math.max(0, 1 - daysSince / 180)
    const scoreDiff = Math.abs((lastMock.scorePercent ?? score) - score) / 100
    const mockEffect = recencyWeight * (1 - scoreDiff)
    // If recent mock aligns with readiness → reduce SD up to 25%; else small increase
    const mockAdj = 1 - (mockEffect * 0.25)
    sdSum = sdSum * Math.max(0.7, Math.min(1.3, mockAdj))
  }

  const halfWidth = z * sdSum * scale
  let low = Math.round(Math.max(0, score - halfWidth))
  let high = Math.round(Math.min(100, score + halfWidth))

  if (low === high) {
    // Ensure a visible range
    low = Math.max(0, low - 1)
    high = Math.min(100, high + 1)
  }

  return { low, high, confidenceLevel: 95, daysUsed: daysToExam ?? null }
}

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
 * Pure helper -- exported for tests.
 */
export function computeReadinessLabel(score: number): ExamReadinessResult['readinessLabel'] {
  if (score < 40) return 'Needs Work'
  if (score < 60) return 'Developing'
  if (score < 80) return 'On Track'
  return 'Exam Ready'
}

/**
 * Pure helper -- exported for tests.
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
 * Weights each chapter's mastery by BoardChapterWeight. Never throws -- returns null on error.
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

    const masteryByConcept = new Map<string, number>(
      states.map((s) => [s.conceptId, s.masteryScore] as [string, number]),
    )
    const weightByChapter = new Map<string, number>(
      weights.map((w) => [w.chapterId, w.weightMarks] as [string, number]),
    )

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
      const masteries: number[] = cIds.map((cid) => masteryByConcept.get(cid) ?? BASELINE_MASTERY)
      const avgMastery =
        masteries.length > 0 ? masteries.reduce((a: number, b: number) => a + b, 0) / masteries.length : 0
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
    const conceptsCovered = concepts.filter((c) => {
      const mastery = masteryByConcept.get(c.id) ?? BASELINE_MASTERY
      return mastery > 0.4
    }).length

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
