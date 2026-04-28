/**
 * Unit tests for updateStudentTopicProgress — dual-write behaviour.
 *
 * Phase 3: Both StudentTopicProgress (atomic SQL) and StudentTopicMastery
 * (Prisma upsert) are written inside a single Prisma transaction.
 *
 * Tests:
 *   1. Both $executeRaw (StudentTopicProgress) and studentTopicMastery.upsert
 *      are called within the same $transaction callback.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Mock dependencies ────────────────────────────────────────────────────────

const mockExecuteRaw = jest.fn().mockResolvedValue(1);
const mockMasteryUpsert = jest.fn().mockResolvedValue({});
const mockProgressFindUnique = jest.fn().mockResolvedValue({ mastery: 0.5, practiceCount: 5 });
const mockTopicDefFindUnique = jest.fn().mockResolvedValue({
  chapter: { name: 'Algebra', subject: { name: 'Mathematics' } },
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        $executeRaw: mockExecuteRaw,
        studentTopicMastery: { upsert: mockMasteryUpsert },
      })
    ),
    studentTopicProgress: { findUnique: mockProgressFindUnique },
    topicDef: { findUnique: mockTopicDefFindUnique },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { updateStudentTopicProgress } from '@/lib/learning/updateTopicProgress';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('updateStudentTopicProgress — dual-write', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecuteRaw.mockResolvedValue(1);
    mockMasteryUpsert.mockResolvedValue({});
    mockProgressFindUnique.mockResolvedValue({ mastery: 0.5, practiceCount: 5 });
    mockTopicDefFindUnique.mockResolvedValue({
      chapter: { name: 'Algebra', subject: { name: 'Mathematics' } },
    });
  });

  it('writes to both StudentTopicProgress and StudentTopicMastery in a single transaction', async () => {
    const { prisma } = await import('@/lib/prisma');

    await updateStudentTopicProgress({
      studentId: 'student-001',
      topicId: 'topic-001',
      correctAnswers: 8,
      totalAnswers: 10,
      activityType: 'PRACTICE',
    });

    // Transaction must have been called
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // Inside the transaction: StudentTopicProgress via $executeRaw
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);

    // Inside the transaction: StudentTopicMastery via upsert
    expect(mockMasteryUpsert).toHaveBeenCalledTimes(1);

    // Verify upsert shape for StudentTopicMastery
    const upsertCall = mockMasteryUpsert.mock.calls[0][0];
    expect(upsertCall.where).toEqual({
      studentId_topicId: { studentId: 'student-001', topicId: 'topic-001' },
    });
    expect(upsertCall.create).toMatchObject({
      studentId: 'student-001',
      topicId: 'topic-001',
      accuracy: 0.8, // 8/10
      questionsAttempted: 10,
    });
    expect(upsertCall.update).toMatchObject({
      accuracy: 0.8,
      questionsAttempted: { increment: 10 },
    });
  });

  it('computes correct masteryLevel from accuracy', async () => {
    await updateStudentTopicProgress({
      studentId: 'student-002',
      topicId: 'topic-002',
      correctAnswers: 9,
      totalAnswers: 10, // accuracy = 0.9 → expert
      activityType: 'TEST',
    });

    const upsertCall = mockMasteryUpsert.mock.calls[0][0];
    expect(upsertCall.create.masteryLevel).toBe('expert');
    expect(upsertCall.update.masteryLevel).toBe('expert');
  });

  it('sets masteryLevel beginner when accuracy < 0.6', async () => {
    await updateStudentTopicProgress({
      studentId: 'student-003',
      topicId: 'topic-003',
      correctAnswers: 3,
      totalAnswers: 10, // accuracy = 0.3 → beginner
      activityType: 'PRACTICE',
    });

    const upsertCall = mockMasteryUpsert.mock.calls[0][0];
    expect(upsertCall.create.masteryLevel).toBe('beginner');
  });

  it('fetches TopicDef for subject and chapter before the transaction', async () => {
    const { prisma } = await import('@/lib/prisma');

    await updateStudentTopicProgress({
      studentId: 'student-004',
      topicId: 'topic-algebra',
      correctAnswers: 7,
      totalAnswers: 10,
      activityType: 'HOMEWORK',
    });

    // TopicDef must be fetched to populate subject/chapter on INSERT
    expect(prisma.topicDef.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'topic-algebra' },
      })
    );

    const upsertCall = mockMasteryUpsert.mock.calls[0][0];
    expect(upsertCall.create.subject).toBe('Mathematics');
    expect(upsertCall.create.chapter).toBe('Algebra');
  });
});
