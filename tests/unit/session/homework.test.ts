/**
 * FILE OBJECTIVE:
 * - Verify homework assignments are created from the shared Question-bank selector and degrade safely to a stub when no bank questions are available.
 *
 * LINKED UNIT TEST:
 * - tests/unit/session/homework.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | rewrite tests for homework generation after unifying runtime question sourcing on the Question bank selector
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    homeworkAssignment: { create: jest.fn() },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/tests', () => ({
  selectQuestions: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { selectQuestions } from '@/lib/tests';
import { generateHomework } from '../../../lib/session/homework';

const STUDENT_ID = 'student-1';
const TOPIC_ID = 'topic-1';
const SESSION_ID = 'session-1';

const BANK_QUESTIONS = Array.from({ length: 5 }, (_, index) => ({
  id: `q-${index}`,
  type: 'mcq',
  prompt: `Question ${index}`,
  choices: ['A', 'B'],
  correctAnswer: 'a',
  difficulty: 'medium',
  // gatherQuestions filters by topicId to guard against selector returning
  // cross-topic rows; the bank fixture must carry it to survive that filter.
  topicId: TOPIC_ID,
}));

describe('generateHomework()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.homeworkAssignment.create as jest.Mock).mockResolvedValue({ id: 'hw-1' });
  });

  it('creates a homework assignment from Question-bank rows', async () => {
    (selectQuestions as jest.Mock).mockResolvedValue(BANK_QUESTIONS);

    const result = await generateHomework(STUDENT_ID, TOPIC_ID, SESSION_ID);

    expect(result).toEqual({ id: 'hw-1', questionCount: 5, isStub: false });
    expect(selectQuestions).toHaveBeenCalledWith({ topicId: TOPIC_ID }, 10, new Set(), new Set());
    expect((prisma.homeworkAssignment.create as jest.Mock).mock.calls[0][0].data.questions).toHaveLength(5);
  });

  it('retries the Question-bank selector once when the first call is empty', async () => {
    (selectQuestions as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(BANK_QUESTIONS.slice(0, 3));

    const result = await generateHomework(STUDENT_ID, TOPIC_ID, SESSION_ID);

    expect(selectQuestions).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: 'hw-1', questionCount: 3, isStub: false });
  });

  it('creates a stub assignment when the Question bank has no usable rows', async () => {
    (selectQuestions as jest.Mock).mockResolvedValue([]);

    const result = await generateHomework(STUDENT_ID, TOPIC_ID, SESSION_ID);

    expect(result).toEqual({ id: 'hw-1', questionCount: 0, isStub: true });
    expect((prisma.homeworkAssignment.create as jest.Mock).mock.calls[0][0].data.questions).toEqual([]);
  });

  it('passes exclude ids and content keys through to the shared selector', async () => {
    (selectQuestions as jest.Mock).mockResolvedValue([]);
    const excludeIds = new Set(['q-1']);
    const excludeContentKeys = new Set(['prompt::choices::answer']);

    await generateHomework(STUDENT_ID, TOPIC_ID, SESSION_ID, excludeIds, excludeContentKeys);

    expect(selectQuestions).toHaveBeenCalledWith(
      { topicId: TOPIC_ID },
      10,
      excludeIds,
      excludeContentKeys,
    );
  });

  it('rethrows when homework assignment persistence fails', async () => {
    (selectQuestions as jest.Mock).mockResolvedValue(BANK_QUESTIONS);
    (prisma.homeworkAssignment.create as jest.Mock).mockRejectedValue(new Error('DB failure'));

    await expect(generateHomework(STUDENT_ID, TOPIC_ID, SESSION_ID)).rejects.toThrow('DB failure');
  });
});
