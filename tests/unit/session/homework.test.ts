/**
 * Unit tests for lib/session/homework.ts
 *
 * Covers:
 *   1. Strategy 1 — Question bank has enough questions (normal path)
 *   2. Strategy 2 — Bank is empty but GeneratedTest has questions
 *   3. Strategy 3 — Topic has no questions; chapter sibling topics do
 *   4. Stub        — All strategies exhausted → isStub: true, questionCount: 0
 *   5. Retry       — First gatherQuestions() returns [] (transient), second returns questions
 *   6. Error       — DB write fails → throws (infra error is not swallowed)
 */

import { generateHomework } from '../../../lib/session/homework';

// ─── Mock prisma ──────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: {
    question: { findMany: jest.fn() },
    generatedTest: { findMany: jest.fn() },
    topicDef: { findUnique: jest.fn(), findMany: jest.fn() },
    homeworkAssignment: { create: jest.fn() },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { prisma } from '@/lib/prisma';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUDENT_ID = 'student-1';
const TOPIC_ID = 'topic-abc';
const SESSION_ID = 'session-xyz';
const CHAPTER_ID = 'chapter-1';

/** Five bank questions — enough to satisfy MIN_QUESTIONS (5). */
const fiveBankQuestions = Array.from({ length: 5 }, (_, i) => ({
  id: `bq-${i}`,
  type: 'mcq',
  prompt: `Bank question ${i}`,
  choices: ['A', 'B', 'C', 'D'],
  correctAnswer: 'A',
  difficulty: 'medium',
}));

/** Three generated questions from a GeneratedTest. */
const threeGenQuestions = Array.from({ length: 3 }, (_, i) => ({
  id: `gq-${i}`,
  type: 'mcq',
  question: `Gen question ${i}`,
  options: ['A', 'B'],
  answer: 'A',
  explanation: 'Because A.',
}));

const mockAssignment = {
  id: 'hw-001',
  status: 'PENDING',
  dueDate: new Date(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockBankQuestions(rows: typeof fiveBankQuestions | []) {
  (prisma.question.findMany as jest.Mock).mockResolvedValue(rows);
}

function mockGenTests(questions: typeof threeGenQuestions | []) {
  (prisma.generatedTest.findMany as jest.Mock).mockResolvedValue(
    questions.length > 0 ? [{ questions }] : []
  );
}

function mockTopicDef(chapterId: string | null) {
  (prisma.topicDef.findUnique as jest.Mock).mockResolvedValue(chapterId ? { chapterId } : null);
}

function mockSiblingTopics(ids: string[]) {
  (prisma.topicDef.findMany as jest.Mock).mockResolvedValue(ids.map((id) => ({ id })));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateHomework()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.homeworkAssignment.create as jest.Mock).mockResolvedValue(mockAssignment);
  });

  // ── Case 1: Strategy 1 (Question bank) ──────────────────────────────────

  it('creates assignment from Question bank when ≥ 5 questions exist', async () => {
    mockBankQuestions(fiveBankQuestions);

    const result = await generateHomework(STUDENT_ID, TOPIC_ID, SESSION_ID);

    expect(result.id).toBe('hw-001');
    expect(result.questionCount).toBe(5);
    expect(result.isStub).toBe(false);

    // Should NOT have needed to query generatedTest or topicDef.
    expect(prisma.generatedTest.findMany).not.toHaveBeenCalled();
    expect(prisma.topicDef.findUnique).not.toHaveBeenCalled();

    // Assignment created with real questions.
    const createCall = (prisma.homeworkAssignment.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.questions).toHaveLength(5);
    expect(createCall.data.status).toBe('PENDING');
  });

  // ── Case 2: Strategy 2 (GeneratedTest, same topic) ──────────────────────

  it('falls back to GeneratedTest questions when Question bank is empty', async () => {
    // Bank empty, generatedTest has 3 questions.
    // First call (initial): bank=[], genTest=[3 q]
    // No retry because genTest supplies enough for combined > 0.
    mockBankQuestions([]);
    mockGenTests(threeGenQuestions);
    // Strategy 3 not needed since we have some questions from strategy 2.
    // gatherQuestions returns combined (3 questions < MIN_QUESTIONS=5, so
    // it proceeds to strategy 3 — we need to also mock topicDef).
    mockTopicDef(null); // No chapter → strategy 3 skipped.

    const result = await generateHomework(STUDENT_ID, TOPIC_ID, SESSION_ID);

    expect(result.isStub).toBe(false);
    expect(result.questionCount).toBe(3);

    const createCall = (prisma.homeworkAssignment.create as jest.Mock).mock.calls[0][0];
    // questions array should contain the 3 gen questions.
    expect((createCall.data.questions as unknown[]).length).toBe(3);
  });

  // ── Case 3: Strategy 3 (chapter sibling fallback) ───────────────────────

  it('falls back to sibling-topic chapter questions when topic has none', async () => {
    const siblingGenQuestions = Array.from({ length: 5 }, (_, i) => ({
      id: `sgq-${i}`,
      type: 'mcq',
      question: `Sibling question ${i}`,
      options: ['X', 'Y'],
      answer: 'X',
      explanation: 'X is correct.',
    }));

    // Both primary strategies return empty.
    mockBankQuestions([]);
    // First generatedTest call (Strategy 2, topicId) returns [].
    // Second generatedTest call (Strategy 3, siblingIds) returns sibling questions.
    (prisma.generatedTest.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // Strategy 2: topic-level
      .mockResolvedValueOnce([{ questions: siblingGenQuestions }]); // Strategy 3: chapter-level

    mockTopicDef(CHAPTER_ID);
    mockSiblingTopics(['sibling-topic-1', 'sibling-topic-2']);

    const result = await generateHomework(STUDENT_ID, TOPIC_ID, SESSION_ID);

    expect(result.isStub).toBe(false);
    expect(result.questionCount).toBe(5);

    const createCall = (prisma.homeworkAssignment.create as jest.Mock).mock.calls[0][0];
    expect((createCall.data.questions as unknown[]).length).toBe(5);
  });

  // ── Case 4: All strategies exhausted → stub ──────────────────────────────

  it('creates a stub assignment (isStub: true, questionCount: 0) when all strategies fail', async () => {
    // Both gatherQuestions() calls return [].
    // Retry fires after RETRY_DELAY_MS but we skip real delay in tests.
    jest.useFakeTimers();

    mockBankQuestions([]);
    (prisma.generatedTest.findMany as jest.Mock).mockResolvedValue([]);
    mockTopicDef(CHAPTER_ID);
    mockSiblingTopics(['sibling-1']);
    // Sibling chapter generatedTest also empty.
    // generatedTest.findMany is called twice: strategy 2 + strategy 3.
    // Both already mocked to return [].

    const promise = generateHomework(STUDENT_ID, TOPIC_ID, SESSION_ID);
    // Advance the internal retry delay (500 ms).
    jest.runAllTimers();
    const result = await promise;

    expect(result.isStub).toBe(true);
    expect(result.questionCount).toBe(0);
    expect(result.id).toBe('hw-001');

    const createCall = (prisma.homeworkAssignment.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.questions).toEqual([]);
    expect(createCall.data.status).toBe('PENDING');

    jest.useRealTimers();
  });

  // ── Case 5: Internal retry on transient empty ────────────────────────────

  it('retries gatherQuestions() once when first call returns empty', async () => {
    jest.useFakeTimers();

    // First gatherQuestions(): bank empty, genTest empty, no chapter.
    // Second gatherQuestions() after retry: bank has questions.
    (prisma.question.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // first attempt — empty
      .mockResolvedValue(fiveBankQuestions); // retry — questions available

    (prisma.generatedTest.findMany as jest.Mock).mockResolvedValue([]);
    mockTopicDef(null); // no chapter, so strategy 3 skipped

    const promise = generateHomework(STUDENT_ID, TOPIC_ID, SESSION_ID);
    jest.runAllTimers();
    const result = await promise;

    expect(result.isStub).toBe(false);
    expect(result.questionCount).toBe(5);

    // question.findMany called exactly twice (one per gatherQuestions()).
    expect(prisma.question.findMany).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  // ── Case 6: DB write failure → re-throws (infra error not swallowed) ─────

  it('re-throws when the homeworkAssignment.create DB write fails', async () => {
    mockBankQuestions(fiveBankQuestions);
    (prisma.homeworkAssignment.create as jest.Mock).mockRejectedValue(
      new Error('DB connection lost')
    );

    await expect(generateHomework(STUDENT_ID, TOPIC_ID, SESSION_ID)).rejects.toThrow(
      'DB connection lost'
    );
  });
});
