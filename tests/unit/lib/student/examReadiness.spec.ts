/**
 * FILE OBJECTIVE:
 * - Unit tests for computeReadinessScore in lib/student/examReadiness.ts.
 * - Covers the Gap 2 fix: equal-weight fallback when boardChapterWeights are
 *   missing/zero, and graceful handling when no concepts are seeded.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/examReadiness.spec.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | created — Gap 2 fix coverage (PROGRESS_PAGE_GAP_AUDIT.md)
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({ prisma: { chapterDef: { findMany: jest.fn() }, studentConceptState: { findMany: jest.fn() }, mockExamAttempt: { findFirst: jest.fn() } } }));
jest.mock('@/lib/redis', () => ({ getRedis: jest.fn().mockReturnValue(null) }));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

import { prisma } from '@/lib/prisma';
import { computeReadinessScore } from '@/lib/student/examReadiness';

const mockChapterDef = prisma.chapterDef.findMany as jest.Mock;
const mockConceptState = prisma.studentConceptState.findMany as jest.Mock;
const mockMockExam = prisma.mockExamAttempt.findFirst as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockMockExam.mockResolvedValue(null);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeChapter(id: string, name: string, weightMarks: number, conceptCount = 2) {
  return {
    id,
    name,
    boardChapterWeights: weightMarks > 0 ? [{ weightMarks }] : [],
    topics: [{ concepts: Array.from({ length: conceptCount }, (_, i) => ({ id: `${id}-c${i}` })) }],
  };
}

function makeChapterNoTopics(id: string, name: string, weightMarks: number) {
  return { id, name, boardChapterWeights: weightMarks > 0 ? [{ weightMarks }] : [], topics: [] };
}

// ── Normal path (board weights present) ──────────────────────────────────────

describe('computeReadinessScore — with board weights', () => {
  it('returns zero-state when no chapters found', async () => {
    mockChapterDef.mockResolvedValue([]);
    const result = await computeReadinessScore('student-1', 'subject-1');
    expect(result).toEqual({ score: 0, label: 'critical', chapters: [] });
  });

  it('computes weighted score from concept mastery states', async () => {
    const chapters = [
      makeChapter('ch1', 'Algebra', 40, 2),
      makeChapter('ch2', 'Geometry', 60, 2),
    ];
    mockChapterDef.mockResolvedValue(chapters);
    // ch1: concepts ch1-c0=0.5, ch1-c1=0.5 → avgMastery=0.5, weight%=40
    // ch2: concepts ch2-c0=0.8, ch2-c1=0.8 → avgMastery=0.8, weight%=60
    // score = 0.5*40 + 0.8*60 = 20 + 48 = 68
    mockConceptState.mockResolvedValue([
      { conceptId: 'ch1-c0', masteryScore: 0.5, retention: null },
      { conceptId: 'ch1-c1', masteryScore: 0.5, retention: null },
      { conceptId: 'ch2-c0', masteryScore: 0.8, retention: null },
      { conceptId: 'ch2-c1', masteryScore: 0.8, retention: null },
    ]);
    const result = await computeReadinessScore('student-1', 'subject-1');
    expect(result.score).toBe(68);
    expect(result.label).toBe('needs_work');
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].boardWeightPct).toBe(40);
    expect(result.chapters[1].boardWeightPct).toBe(60);
  });

  it('assigns masteryScore=0 for untouched concepts (no student states)', async () => {
    mockChapterDef.mockResolvedValue([makeChapter('ch1', 'Algebra', 100, 2)]);
    mockConceptState.mockResolvedValue([]);
    const result = await computeReadinessScore('student-1', 'subject-1');
    expect(result.score).toBe(0);
    expect(result.chapters[0].masteryScore).toBe(0);
  });
});

// ── Gap 2 fix: equal-weight fallback ─────────────────────────────────────────

describe('computeReadinessScore — equal-weight fallback (Gap 2 fix)', () => {
  it('does NOT return zero-state when boardChapterWeights are all missing', async () => {
    // Chapters with no board weight rows
    const chapters = [
      makeChapter('ch1', 'Algebra', 0, 2),
      makeChapter('ch2', 'Geometry', 0, 2),
    ];
    mockChapterDef.mockResolvedValue(chapters);
    mockConceptState.mockResolvedValue([
      { conceptId: 'ch1-c0', masteryScore: 0.6, retention: null },
      { conceptId: 'ch1-c1', masteryScore: 0.6, retention: null },
      { conceptId: 'ch2-c0', masteryScore: 0.4, retention: null },
      { conceptId: 'ch2-c1', masteryScore: 0.4, retention: null },
    ]);
    const result = await computeReadinessScore('student-1', 'subject-1');
    // equal weight: each chapter is 50% of total
    // score = 0.6*50 + 0.4*50 = 30+20 = 50
    expect(result.chapters).toHaveLength(2);
    expect(result.score).toBe(50);
    expect(result.chapters[0].boardWeightPct).toBe(50);
    expect(result.chapters[1].boardWeightPct).toBe(50);
  });

  it('assigns equal weight when boardChapterWeights are empty arrays', async () => {
    const chapters = [
      { id: 'ch1', name: 'Algebra', boardChapterWeights: [], topics: [{ concepts: [{ id: 'ch1-c0' }] }] },
      { id: 'ch2', name: 'Calculus', boardChapterWeights: [], topics: [{ concepts: [{ id: 'ch2-c0' }] }] },
      { id: 'ch3', name: 'Statistics', boardChapterWeights: [], topics: [{ concepts: [{ id: 'ch3-c0' }] }] },
    ];
    mockChapterDef.mockResolvedValue(chapters);
    mockConceptState.mockResolvedValue([
      { conceptId: 'ch1-c0', masteryScore: 1.0, retention: null },
      { conceptId: 'ch2-c0', masteryScore: 0.0, retention: null },
      { conceptId: 'ch3-c0', masteryScore: 0.0, retention: null },
    ]);
    const result = await computeReadinessScore('student-1', 'subject-1');
    // 3 chapters, equal weight = 1/3 each (~33.33%)
    // score = 1.0*(100/3) + 0 + 0 ≈ 33
    expect(result.chapters).toHaveLength(3);
    expect(result.score).toBeCloseTo(33, 0);
    // Each chapter gets ~33.3% weight
    result.chapters.forEach((ch) => {
      expect(ch.boardWeightPct).toBeCloseTo(33.3, 0);
    });
  });

  it('renders chapters with score 0 when no concepts seeded (no zero-state early return)', async () => {
    // Chapters with no topics/concepts and no board weights
    const chapters = [
      makeChapterNoTopics('ch1', 'Algebra', 0),
      makeChapterNoTopics('ch2', 'Geometry', 0),
    ];
    mockChapterDef.mockResolvedValue(chapters);
    // No concept states to fetch
    mockConceptState.mockResolvedValue([]);
    const result = await computeReadinessScore('student-1', 'subject-1');
    // Should still render both chapters (masteryScore=0 for each), not return zero-state
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].masteryScore).toBe(0);
    expect(result.chapters[1].masteryScore).toBe(0);
    expect(result.score).toBe(0);
  });

  it('uses real board weights when at least one chapter has them', async () => {
    // Mixed: ch1 has weights, ch2 does not — rawTotal > 0 so normal path used
    const chapters = [
      makeChapter('ch1', 'Algebra', 80, 1),
      { id: 'ch2', name: 'Geometry', boardChapterWeights: [], topics: [{ concepts: [{ id: 'ch2-c0' }] }] },
    ];
    mockChapterDef.mockResolvedValue(chapters);
    mockConceptState.mockResolvedValue([
      { conceptId: 'ch1-c0', masteryScore: 1.0, retention: null },
      { conceptId: 'ch2-c0', masteryScore: 0.5, retention: null },
    ]);
    const result = await computeReadinessScore('student-1', 'subject-1');
    // rawTotal=80, ch2 weightMarks=0 → not equal-weight path
    // ch1: 1.0 * (80/80)*100 = 100 contribution
    // ch2: 0.5 * (0/80)*100 = 0 contribution
    // score = 100 → but clamp at 100
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].boardWeightPct).toBe(100);
    expect(result.chapters[1].boardWeightPct).toBe(0);
    expect(result.score).toBe(100);
  });
});

// ── readinessLabel thresholds ─────────────────────────────────────────────────

describe('readiness label thresholds', () => {
  it.each([
    [0, 'critical'],
    [39, 'critical'],
    [40, 'needs_work'],
    [69, 'needs_work'],
    [70, 'on_track'],
    [89, 'on_track'],
    [90, 'ready'],
    [100, 'ready'],
  ])('score %i → label "%s"', async (targetScore, expectedLabel) => {
    // Craft a single chapter with boardWeight=100 so score == avgMastery*100
    const mastery = targetScore / 100;
    mockChapterDef.mockResolvedValue([makeChapter('ch1', 'Chapter', 100, 1)]);
    mockConceptState.mockResolvedValue([{ conceptId: 'ch1-c0', masteryScore: mastery, retention: null }]);
    const result = await computeReadinessScore('student-1', 'subject-1');
    expect(result.score).toBe(targetScore);
    expect(result.label).toBe(expectedLabel);
  });
});
