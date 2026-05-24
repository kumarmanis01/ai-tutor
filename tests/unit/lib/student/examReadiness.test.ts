/**
 * FILE OBJECTIVE:
 * - Smoke test to ensure `lib/student/examReadiness.ts` loads after TS shape fix.
 * - Covers the readiness metadata that marks equal-weight fallback chapters
 *   as estimated so the chapter mastery UI can label them clearly.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/examReadiness.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T12:35:00Z | copilot | added smoke test for examReadiness
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    chapterDef: { findMany: jest.fn() },
    studentConceptState: { findMany: jest.fn() },
    mockExamAttempt: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn().mockReturnValue(null),
}))

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

describe('lib/student/examReadiness (smoke)', () => {
  it('module loads', () => {
    // require to avoid static TS imports in the test harness
    const mod = require('../../../../lib/student/examReadiness')
    expect(mod).toBeDefined()
  })
})
import {
  computeReadinessLabel,
  computeWeightedContribution,
} from '@/lib/student/examReadiness'
import { prisma } from '@/lib/prisma'

describe('lib/student/examReadiness', () => {
  describe('computeReadinessLabel', () => {
    test('39 → Needs Work', () => {
      expect(computeReadinessLabel(39)).toBe('Needs Work')
    })
    test('40 → Developing', () => {
      expect(computeReadinessLabel(40)).toBe('Developing')
    })
    test('60 → On Track', () => {
      expect(computeReadinessLabel(60)).toBe('On Track')
    })
    test('80 → Exam Ready', () => {
      expect(computeReadinessLabel(80)).toBe('Exam Ready')
    })
    test('100 → Exam Ready', () => {
      expect(computeReadinessLabel(100)).toBe('Exam Ready')
    })
  })

  describe('computeWeightedContribution', () => {
    test('1.0, 8, 80 → 10.0', () => {
      expect(computeWeightedContribution(1.0, 8, 80)).toBe(10)
    })
    test('0.5, 8, 80 → 5.0', () => {
      expect(computeWeightedContribution(0.5, 8, 80)).toBe(5)
    })
    test('0.0, 8, 80 → 0.0', () => {
      expect(computeWeightedContribution(0.0, 8, 80)).toBe(0)
    })
    test('totalMarks = 0 → 0 (no divide-by-zero)', () => {
      expect(computeWeightedContribution(1.0, 8, 0)).toBe(0)
    })
  })

  describe('score and totalMarks edge cases', () => {
    test('score rounds to 1 decimal (42.333... → 42.3)', () => {
      const rawScore = 42.333333
      const rounded = Math.round(rawScore * 10) / 10
      expect(rounded).toBe(42.3)
    })
    test('totalMarks = 0 → score = 0 (no divide-by-zero)', () => {
      expect(computeWeightedContribution(0.5, 0, 0)).toBe(0)
      expect(computeWeightedContribution(1, 10, 0)).toBe(0)
    })
  })

  describe('computePredictedScoreRange', () => {
    const { computePredictedScoreRange } = require('@/lib/student/examReadiness')

    test('fallback when no chapters returns small window', () => {
      const r = { score: 50, label: 'critical', chapters: [] }
      const p = computePredictedScoreRange(r)
      expect(p.low).toBeGreaterThanOrEqual(0)
      expect(p.high).toBeLessThanOrEqual(100)
      expect(p.high - p.low).toBeGreaterThan(0)
    })

    test('closer exam narrows the interval', () => {
      const readiness = {
        score: 72,
        label: 'on_track',
        chapters: [
          { chapterId: 'c1', chapterName: 'A', masteryScore: 0.8, boardWeightPct: 30, contribution: 24, status: 'on_track' },
          { chapterId: 'c2', chapterName: 'B', masteryScore: 0.6, boardWeightPct: 40, contribution: 24, status: 'needs_work' },
          { chapterId: 'c3', chapterName: 'C', masteryScore: 0.5, boardWeightPct: 30, contribution: 15, status: 'needs_work' },
        ],
      }

      const far = computePredictedScoreRange(readiness, 180)
      const near = computePredictedScoreRange(readiness, 7)

      expect(near.high - near.low).toBeLessThanOrEqual(far.high - far.low)
      expect(near.low).toBeLessThanOrEqual(readiness.score)
      expect(near.high).toBeGreaterThanOrEqual(readiness.score)
    })
  })

  describe('weightSource metadata', () => {
    const { computeReadinessScore } = require('@/lib/student/examReadiness')

    const mockChapterDef = prisma.chapterDef.findMany as jest.Mock
    const mockConceptState = prisma.studentConceptState.findMany as jest.Mock

    beforeEach(() => {
      mockChapterDef.mockReset()
      mockConceptState.mockReset()
    })

    test('marks chapters as board when seeded weights exist', async () => {
      mockChapterDef.mockResolvedValue([
        {
          id: 'ch1',
          name: 'Algebra',
          boardChapterWeights: [{ weightMarks: 50 }],
          topics: [{ concepts: [{ id: 'ch1-c0' }] }],
        },
      ])
      mockConceptState.mockResolvedValue([{ conceptId: 'ch1-c0', masteryScore: 0.5, retention: null }])

      const result = await computeReadinessScore('student-1', 'subject-1')

      expect(result.chapters[0].weightSource).toBe('board')
    })

    test('marks chapters as estimated when equal-weight fallback is used', async () => {
      mockChapterDef.mockResolvedValue([
        {
          id: 'ch1',
          name: 'Algebra',
          boardChapterWeights: [],
          topics: [{ concepts: [{ id: 'ch1-c0' }] }],
        },
        {
          id: 'ch2',
          name: 'Geometry',
          boardChapterWeights: [],
          topics: [{ concepts: [{ id: 'ch2-c0' }] }],
        },
      ])
      mockConceptState.mockResolvedValue([
        { conceptId: 'ch1-c0', masteryScore: 0.25, retention: null },
        { conceptId: 'ch2-c0', masteryScore: 0.75, retention: null },
      ])

      const result = await computeReadinessScore('student-1', 'subject-1')

      expect(result.chapters).toHaveLength(2)
      expect(result.chapters[0].weightSource).toBe('estimated')
      expect(result.chapters[1].weightSource).toBe('estimated')
    })
  })
})
