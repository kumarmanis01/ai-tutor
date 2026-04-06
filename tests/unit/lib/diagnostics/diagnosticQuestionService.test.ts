/**
 * Unit tests for lib/diagnostics/diagnosticQuestionService.ts
 *
 * Covers:
 *   - No duplicate question IDs within a difficulty band (within-band dedup)
 *   - No duplicate question IDs across difficulty bands (cross-band dedup)
 *   - Correct assembly of DiagnosticTest shape
 */

import { generateSubjectDiagnosticTest } from '@/lib/diagnostics/diagnosticQuestionService';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subjectDef: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/tests', () => ({
  ensureQuestions: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/config', () => ({
  diagnosticConfig: { minItems: 15, rapidFireThresholdMs: 1000, rapidFireRatioThreshold: 0.3 },
  computeDifficultyCounts: () => ({ totalItems: 15, easy: 6, medium: 6, hard: 3 }),
}));

const { prisma } = require('@/lib/prisma');
const { ensureQuestions } = require('@/lib/tests');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQuestion(id: string, topicId: string, difficulty: string) {
  return {
    id,
    prompt: `Question ${id}`,
    choices: JSON.stringify(['A', 'B', 'C', 'D']),
    correctAnswer: '0',
    topicId,
    difficulty,
  };
}

const SUBJECT_DEF = {
  id: 'subj-1',
  name: 'Mathematics',
  chapters: [
    {
      id: 'chap-1',
      name: 'Algebra',
      order: 1,
      topics: [
        { id: 'topic-1', name: 'Linear Equations' },
        { id: 'topic-2', name: 'Quadratics' },
        { id: 'topic-3', name: 'Polynomials' },
      ],
    },
    {
      id: 'chap-2',
      name: 'Geometry',
      order: 2,
      topics: [
        { id: 'topic-4', name: 'Circles' },
        { id: 'topic-5', name: 'Triangles' },
        { id: 'topic-6', name: 'Coordinate Geometry' },
      ],
    },
  ],
};

const BASE_PARAMS = {
  boardSlug: 'cbse',
  grade: 9,
  subjectSlug: 'mathematics',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateSubjectDiagnosticTest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.subjectDef.findFirst.mockResolvedValue(SUBJECT_DEF);
  });

  it('should return no duplicate question IDs when bank is large', async () => {
    // Each ensureQuestions call returns a unique question based on topicId
    ensureQuestions.mockImplementation(
      async (filters: { topicId?: string; difficulty?: string }, count: number) => {
        const topicId = filters.topicId ?? 'subject';
        const diff = filters.difficulty ?? 'easy';
        return Array.from({ length: count }, (_, i) => makeQuestion(`${diff}-${topicId}-${i}`, topicId, diff));
      },
    );

    const result = await generateSubjectDiagnosticTest(BASE_PARAMS);

    const ids = result.questions.map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('should deduplicate within a band when ensureQuestions returns the same question on every topic call', async () => {
    // Simulate a thin question bank: every topic call returns the same question ID for that difficulty.
    ensureQuestions.mockImplementation(
      async (filters: { topicId?: string; difficulty?: string }, _count: number) => {
        const diff = filters.difficulty ?? 'easy';
        if (filters.topicId) {
          // All topics return the same shared question per difficulty
          return [makeQuestion(`shared-${diff}`, filters.topicId, diff)];
        }
        // Subject-level fallback: return one extra unique question
        return [makeQuestion(`fallback-${diff}`, 'subject', diff)];
      },
    );

    const result = await generateSubjectDiagnosticTest(BASE_PARAMS);

    const ids = result.questions.map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('should deduplicate across bands when the same question appears in multiple difficulties', async () => {
    // The question bank only has one question total -- the same ID is returned regardless of difficulty
    const SAME_ID = 'q-only-one';
    ensureQuestions.mockResolvedValue([makeQuestion(SAME_ID, 'topic-1', 'easy')]);

    const result = await generateSubjectDiagnosticTest(BASE_PARAMS);

    const ids = result.questions.map((q) => q.id);
    const occurrences = ids.filter((id) => id === SAME_ID).length;
    expect(occurrences).toBe(1);
  });

  it('should return questions with the correct structure', async () => {
    ensureQuestions.mockImplementation(
      async (filters: { topicId?: string; difficulty?: string }, count: number) => {
        const topicId = filters.topicId ?? 'subject';
        const diff = filters.difficulty ?? 'easy';
        return Array.from({ length: count }, (_, i) => makeQuestion(`${diff}-${topicId}-${i}`, topicId, diff));
      },
    );

    const result = await generateSubjectDiagnosticTest(BASE_PARAMS);

    expect(result.subjectId).toBe('subj-1');
    expect(result.subjectName).toBe('Mathematics');
    expect(result.boardSlug).toBe('cbse');
    expect(result.grade).toBe(9);
    expect(Array.isArray(result.questions)).toBe(true);
    for (const q of result.questions) {
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('questionText');
      expect(q).toHaveProperty('options');
      expect(q).toHaveProperty('correctAnswer');
      expect(q).toHaveProperty('topicId');
      expect(q).toHaveProperty('difficulty');
      expect(Array.isArray(q.options)).toBe(true);
    }
  });
});
