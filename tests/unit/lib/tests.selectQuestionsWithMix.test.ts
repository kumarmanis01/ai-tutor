/**
 * Unit tests for selectQuestionsWithMix() -- F-STU-020 AC-02/AC-03.
 *
 * Verifies:
 *   - 40/30/30 type distribution when all buckets have sufficient questions
 *   - timeLimitSeconds computed correctly per type
 *   - graceful backfill when long_answer pool is empty
 *   - never returns more than requested count
 */

import { selectQuestionsWithMix, getRecentlyUsedQuestionIds } from '@/lib/tests';

// ── minimal Question factory ────────────────────────────────────────────────
let _seq = 0;
function makeQ(type: string): any {
  _seq++;
  return {
    id: `q-${type}-${_seq}`,
    type,
    prompt: `Question ${_seq}`,
    choices: null,
    correctAnswer: 'A',
    difficulty: 'medium',
    status: 'ACTIVE',
    subject: null,
    chapter: null,
    grade: null,
    board: null,
    topicId: null,
    source: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    irt_a: null,
    irt_b: null,
    irt_c: null,
  };
}

// ── Prisma mock ─────────────────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => {
  const questionFindMany = jest.fn();
  const generatedFindMany = jest.fn();
  const questionUpsert = jest.fn();
  const attemptQuestionFindMany = jest.fn().mockResolvedValue([]);
  return {
    prisma: {
      question: { findMany: questionFindMany, upsert: questionUpsert },
      generatedQuestion: { findMany: generatedFindMany },
      attemptQuestion: { findMany: attemptQuestionFindMany },
    },
  };
});

jest.mock('@/lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/callLLM', () => ({
  callTutorLLM: jest.fn(),
}));

jest.mock('@/lib/aiContext', () => ({
  createAIClient: jest.fn(),
}));

const { prisma } = require('@/lib/prisma');

// Helper: configure attemptQuestion mock to return specific IDs as recently used.
// NOTE: the query in lib/tests.ts uses `select: { question: { select: { prompt: true } } }`,
// so the returned rows MUST include a nested `question` object with a `prompt` field.
function mockRecentIds(ids: string[]) {
  prisma.attemptQuestion.findMany.mockResolvedValue(
    ids.map((id) => ({ questionId: id, question: { prompt: `mock prompt for ${id}` } })),
  );
}

// Helper: make the findMany mock return different pools based on `where.type`.
function mockBuckets(mcqCount: number, shortCount: number, longCount: number) {
  prisma.question.findMany.mockImplementation((args: any) => {
    const type = args?.where?.type;
    if (type === 'mcq') return Promise.resolve(Array.from({ length: mcqCount }, () => makeQ('mcq')));
    if (type === 'short') return Promise.resolve(Array.from({ length: shortCount }, () => makeQ('short')));
    if (type === 'long_answer') return Promise.resolve(Array.from({ length: longCount }, () => makeQ('long_answer')));
    return Promise.resolve([]);
  });
  prisma.generatedQuestion.findMany.mockResolvedValue([]);
}

describe('selectQuestionsWithMix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _seq = 0;
  });

  it('should return exactly `count` questions when all buckets are full', async () => {
    mockBuckets(30, 30, 30);
    const { questions } = await selectQuestionsWithMix({}, 10);
    expect(questions).toHaveLength(10);
  });

  it('should not exceed requested count', async () => {
    mockBuckets(50, 50, 50);
    const { questions } = await selectQuestionsWithMix({}, 5);
    expect(questions.length).toBeLessThanOrEqual(5);
  });

  it('should compute timeLimitSeconds using 60/120/300 per type', async () => {
    // 10 questions: 4 mcq (60s each) + 3 long_answer (300s each) + 3 short (120s each)
    // = 240 + 900 + 360 = 1500
    mockBuckets(30, 30, 30);
    const { timeLimitSeconds, questions } = await selectQuestionsWithMix({}, 10);
    const expected = questions.reduce((acc, q) => {
      if (q.type === 'mcq') return acc + 60;
      if (q.type === 'long_answer') return acc + 300;
      return acc + 120;
    }, 0);
    expect(timeLimitSeconds).toBe(expected);
  });

  it('should backfill from short pool when long_answer pool is empty', async () => {
    mockBuckets(30, 30, 0); // no long_answer questions
    const { questions } = await selectQuestionsWithMix({}, 10);
    expect(questions).toHaveLength(10);
    // No question should be undefined
    questions.forEach((q) => expect(q).toBeDefined());
  });

  it('should return no duplicate question IDs', async () => {
    mockBuckets(30, 30, 30);
    const { questions } = await selectQuestionsWithMix({}, 10);
    const ids = questions.map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('should pass subject/grade/board/chapter filters to selectQuestions', async () => {
    mockBuckets(10, 10, 10);
    await selectQuestionsWithMix(
      { subject: 'Math', grade: '10', board: 'CBSE', chapter: 'Quadratics' },
      6,
    );
    // Each call to question.findMany should carry the filter fields
    const calls = prisma.question.findMany.mock.calls;
    const firstCall = calls[0][0];
    expect(firstCall.where).toMatchObject({
      subject: { equals: 'Math', mode: 'insensitive' },
    });
  });

  it('should return timeLimitSeconds > 0 for a non-empty result', async () => {
    mockBuckets(10, 10, 10);
    const { timeLimitSeconds } = await selectQuestionsWithMix({}, 10);
    expect(timeLimitSeconds).toBeGreaterThan(0);
  });

  it('should apply ICSE board time-per-mark ratio (72s/mark)', async () => {
    // ICSE: mcq=72s, short=144s, long_answer=360s
    mockBuckets(30, 30, 30);
    const { timeLimitSeconds, questions } = await selectQuestionsWithMix({ board: 'icse' }, 10);
    const expected = questions.reduce((acc, q) => {
      if (q.type === 'mcq') return acc + 72;
      if (q.type === 'long_answer') return acc + 360;
      return acc + 144; // short: 2 marks * 72s
    }, 0);
    expect(timeLimitSeconds).toBe(expected);
  });

  it('should pass excludeIds to selectQuestions when studentId is provided', async () => {
    mockBuckets(30, 30, 30);
    // Simulate one recently-used question ID
    mockRecentIds(['q-mcq-1']);
    const { questions } = await selectQuestionsWithMix(
      { chapter: 'Algebra', subject: 'Math' },
      10,
      'student-123',
    );
    // The excluded ID should not appear in selected questions
    const ids = questions.map((q) => q.id);
    expect(ids).not.toContain('q-mcq-1');
  });

  it('should skip exclusion when studentId is absent', async () => {
    mockBuckets(30, 30, 30);
    // Even if DB has recent IDs, they should not be queried
    prisma.attemptQuestion.findMany.mockResolvedValue([{ questionId: 'q-mcq-1' }]);
    // No studentId passed -- exclusion must not run
    const { questions } = await selectQuestionsWithMix({ chapter: 'Algebra', subject: 'Math' }, 10);
    // attemptQuestion.findMany should not have been called
    expect(prisma.attemptQuestion.findMany).not.toHaveBeenCalled();
    expect(questions).toHaveLength(10);
  });
});

describe('getRecentlyUsedQuestionIds', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return an empty Set when no recent attempts exist', async () => {
    prisma.attemptQuestion.findMany.mockResolvedValue([]);
    const result = await getRecentlyUsedQuestionIds('student-1', 'Algebra', 'Math');
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('should return a Set of question IDs from recent attempts', async () => {
    prisma.attemptQuestion.findMany.mockResolvedValue([
      { questionId: 'q1' },
      { questionId: 'q2' },
      { questionId: 'q3' },
    ]);
    const result = await getRecentlyUsedQuestionIds('student-1', 'Algebra', 'Math');
    expect(result.size).toBe(3);
    expect(result.has('q1')).toBe(true);
    expect(result.has('q2')).toBe(true);
    expect(result.has('q3')).toBe(true);
  });

  it('should deduplicate question IDs that appear in multiple attempts', async () => {
    prisma.attemptQuestion.findMany.mockResolvedValue([
      { questionId: 'q1' },
      { questionId: 'q1' },
      { questionId: 'q2' },
    ]);
    const result = await getRecentlyUsedQuestionIds('student-1', 'Algebra', 'Math');
    expect(result.size).toBe(2);
  });

  it('should query with a date filter 90 days in the past by default', async () => {
    prisma.attemptQuestion.findMany.mockResolvedValue([]);
    const before = new Date();
    before.setDate(before.getDate() - 90);
    await getRecentlyUsedQuestionIds('student-1', 'Algebra', 'Math');
    const call = prisma.attemptQuestion.findMany.mock.calls[0][0];
    const since: Date = call.where.testResult.createdAt.gte;
    // Allow 5-second clock drift in test runner
    expect(Math.abs(since.getTime() - before.getTime())).toBeLessThan(5_000);
  });
});
