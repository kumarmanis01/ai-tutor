/**
 * FILE OBJECTIVE:
 * - Unit tests for `lib/tests.ts` selectQuestions behaviour (topicId filtering and fallback).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/tests.selectQuestions.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-06T13:00:00Z | senior-staff-engineer | created tests for selectQuestions
 */

import { selectQuestions } from '@/lib/tests';

jest.mock('@/lib/prisma', () => {
  // Minimal mocked prisma shape used by selectQuestions / syncFromGeneratedQuestions
  const questionFindMany = jest.fn();
  const generatedFindMany = jest.fn();
  const questionUpsert = jest.fn();
  return {
    prisma: {
      question: {
        findMany: questionFindMany,
        upsert: questionUpsert,
      },
      generatedQuestion: {
        findMany: generatedFindMany,
      },
    },
  };
});

const { prisma } = require('@/lib/prisma');

describe('selectQuestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies topicId filter when provided', async () => {
    prisma.question.findMany.mockResolvedValue([]);
    prisma.generatedQuestion.findMany.mockResolvedValue([]);

    await selectQuestions({ topicId: 'topic-123' }, 2);

    expect(prisma.question.findMany).toHaveBeenCalled();
    const firstCallArgs = prisma.question.findMany.mock.calls[0][0];
    expect(firstCallArgs).toHaveProperty('where');
    expect(firstCallArgs.where).toHaveProperty('topicId', 'topic-123');
  });

  it('falls back to generatedQuestion when pool is insufficient', async () => {
    // initial bank empty
    prisma.question.findMany.mockResolvedValue([]);
    // generatedQuestion returns no rows (we only assert it was called)
    prisma.generatedQuestion.findMany.mockResolvedValue([]);

    await selectQuestions({ subject: 'math' }, 3);

    expect(prisma.generatedQuestion.findMany).toHaveBeenCalled();
  });
});
