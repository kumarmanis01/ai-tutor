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
      findUnique: jest.fn(),
    },
    topicDef: {
      findMany: jest.fn(),
    },
    question: {
      create: jest.fn(),
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

// mockOpenAICreate must be declared at module scope so the jest.mock factory closure
// captures the binding. The factory is called lazily at require() time, after this
// variable is initialised, so the reference is always valid.
const mockOpenAICreate = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
  })),
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

  // ── Exclusion-set tests ────────────────────────────────────────────────────

  it('passes the exclusion set through to ensureQuestions on every call', async () => {
    const excludeIds = new Set(['existing-q-1', 'existing-q-2']);

    ensureQuestions.mockImplementation(
      async (filters: { topicId?: string; difficulty?: string }, count: number) => {
        const topicId = filters.topicId ?? 'subject';
        const diff = filters.difficulty ?? 'easy';
        return Array.from({ length: count }, (_, i) => makeQuestion(`${diff}-${topicId}-${i}`, topicId, diff));
      },
    );

    await generateSubjectDiagnosticTest(BASE_PARAMS, excludeIds);

    // Every ensureQuestions call must receive the exclusion set as the third argument
    for (const call of ensureQuestions.mock.calls) {
      expect(call[2]).toBe(excludeIds);
    }
  });

  it('never returns a question whose ID is in the exclusion set', async () => {
    const EXCLUDED_ID = 'excluded-q-1';
    const excludeIds = new Set([EXCLUDED_ID]);

    ensureQuestions.mockImplementation(
      async (filters: { topicId?: string; difficulty?: string }, count: number, _excludes?: Set<string>) => {
        const topicId = filters.topicId ?? 'subject';
        const diff = filters.difficulty ?? 'easy';
        // Simulate a bank that always tries to return the excluded question first,
        // then falls back to a valid alternative — the service must honour the exclusion.
        return Array.from({ length: count }, (_, i) => {
          const id = i === 0 ? EXCLUDED_ID : `${diff}-${topicId}-${i}`;
          return makeQuestion(id, topicId, diff);
        }).filter((q) => !(_excludes?.has(q.id)));
      },
    );

    const result = await generateSubjectDiagnosticTest(BASE_PARAMS, excludeIds);

    const ids = result.questions.map((q) => q.id);
    expect(ids).not.toContain(EXCLUDED_ID);
  });

  it('works correctly when excludeQuestionIds is undefined (no exclusion)', async () => {
    ensureQuestions.mockImplementation(
      async (filters: { topicId?: string; difficulty?: string }, count: number) => {
        const topicId = filters.topicId ?? 'subject';
        const diff = filters.difficulty ?? 'easy';
        return Array.from({ length: count }, (_, i) => makeQuestion(`${diff}-${topicId}-${i}`, topicId, diff));
      },
    );

    // No exclusion set passed -- should behave identically to the original call
    const result = await generateSubjectDiagnosticTest(BASE_PARAMS, undefined);
    expect(Array.isArray(result.questions)).toBe(true);
    // Verify ensureQuestions was called with undefined as the third arg (not an empty Set)
    for (const call of ensureQuestions.mock.calls) {
      expect(call[2]).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// On-demand LLM generation tests
// ---------------------------------------------------------------------------

describe('generateSubjectDiagnosticTest -- on-demand LLM generation', () => {
  // 6 easy + 6 medium + 3 hard = 15 questions, matching the config mock
  function makeLLMResponse(): string {
    const items = [
      ...Array.from({ length: 6 }, (_, i) => ({
        prompt: `Easy Q${i}`,
        choices: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'A',
        difficulty: 'easy',
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        prompt: `Medium Q${i}`,
        choices: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'B',
        difficulty: 'medium',
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        prompt: `Hard Q${i}`,
        choices: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'C',
        difficulty: 'hard',
      })),
    ];
    return JSON.stringify(items);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.subjectDef.findFirst.mockResolvedValue(SUBJECT_DEF);
    prisma.topicDef.findMany.mockResolvedValue([
      { id: 'topic-1', name: 'Algebra' },
      { id: 'topic-2', name: 'Geometry' },
    ]);
    // Each create call returns a unique persisted ID via a closure counter.
    // mockImplementation replaces the previous closure with a fresh counter.
    let createCount = 0;
    prisma.question.create.mockImplementation(async () => ({ id: `persisted-q-${++createCount}` }));
    ensureQuestions.mockResolvedValue([]);
    process.env.FEATURE_ONDEMAND_DIAGNOSTIC = 'true';
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.LLM_MODE;
  });

  afterEach(() => {
    delete process.env.FEATURE_ONDEMAND_DIAGNOSTIC;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_MODE;
  });

  it('should call OpenAI and return generated questions when bank is empty and flag is on', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: makeLLMResponse() } }],
    });

    const result = await generateSubjectDiagnosticTest(BASE_PARAMS);

    expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    expect(result.questions).toHaveLength(15);
    expect(result.subjectId).toBe(SUBJECT_DEF.id);
    expect(result.subjectName).toBe(SUBJECT_DEF.name);
  });

  it('should assign A/B/C/D keys to options and preserve the correctAnswer letter', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                prompt: 'What is 2+2?',
                choices: ['1', '3', '4', '8'],
                correctAnswer: 'C',
                difficulty: 'easy',
              },
            ]),
          },
        },
      ],
    });
    prisma.question.create.mockResolvedValueOnce({ id: 'q-key-test' });

    const result = await generateSubjectDiagnosticTest(BASE_PARAMS);

    expect(result.questions).toHaveLength(1);
    const q = result.questions[0];
    expect(q.options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'D']);
    // correctAnswer 'C' matches options[2].key
    expect(q.correctAnswer).toBe('C');
    expect(q.options[2].key).toBe(q.correctAnswer);
  });

  it('should persist choices as a JSON string in the Question table', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                prompt: 'Q1',
                choices: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
                correctAnswer: 'B',
                difficulty: 'easy',
              },
            ]),
          },
        },
      ],
    });
    prisma.question.create.mockResolvedValueOnce({ id: 'q-persist-test' });

    await generateSubjectDiagnosticTest(BASE_PARAMS);

    expect(prisma.question.create).toHaveBeenCalledTimes(1);
    const { data } = prisma.question.create.mock.calls[0][0];
    expect(typeof data.choices).toBe('string');
    const parsed = JSON.parse(data.choices);
    expect(parsed).toEqual(['Opt A', 'Opt B', 'Opt C', 'Opt D']);
  });

  it('should return empty questions (not throw) when the OpenAI call fails', async () => {
    mockOpenAICreate.mockRejectedValueOnce(new Error('onDemand_llm_timeout'));

    const result = await generateSubjectDiagnosticTest(BASE_PARAMS);

    expect(result.questions).toEqual([]);
    expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
  });

  it('should return empty questions (not throw) when OpenAI returns unparseable content', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'not valid json at all' } }],
    });

    const result = await generateSubjectDiagnosticTest(BASE_PARAMS);

    expect(result.questions).toEqual([]);
  });

  it('should NOT call OpenAI when FEATURE_ONDEMAND_DIAGNOSTIC is not set', async () => {
    delete process.env.FEATURE_ONDEMAND_DIAGNOSTIC;

    const result = await generateSubjectDiagnosticTest(BASE_PARAMS);

    expect(mockOpenAICreate).not.toHaveBeenCalled();
    expect(result.questions).toEqual([]);
  });
});
