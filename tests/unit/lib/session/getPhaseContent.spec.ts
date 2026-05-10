/**
 * FILE OBJECTIVE:
 * - Unit tests for session phase content resolution, including practice fallback
 *   promotion from GeneratedQuestion rows into the student-facing Question table.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/session/getPhaseContent.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | add practice promotion test to cover GeneratedQuestion fallback and rejection-aware lookup
 * - 2026-05-09T00:00:00Z | copilot | assert PRACTICE phase query/result include correctAnswer for client feedback grading
 * - 2026-05-09T00:00:00Z | copilot | add Jest globals import and relative dynamic import path for TS diagnostics compatibility
 * - 2026-05-10T00:00:00Z | copilot | add regression test for PRACTICE deduplication when question bank contains repeated rows
 * - 2026-05-10T00:00:00Z | copilot | relax ordering assertions for PRACTICE result because selection is now randomized
 * - 2026-05-10T00:00:00Z | copilot | cover promotion-time dedupe safeguards for GeneratedQuestion fallback path
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@/lib/ai/adaptiveDifficulty', () => ({
  resolveTargetDifficulty: jest.fn(() => 'medium'),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    question: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    generatedQuestion: {
      findMany: jest.fn(),
    },
    generatedTest: {
      findFirst: jest.fn(),
    },
    topicDef: {
      findUnique: jest.fn(),
    },
    topicNote: {
      findFirst: jest.fn(),
    },
    homeworkAssignment: {
      findFirst: jest.fn(),
    },
    structuredSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('resolvePhaseContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Safe defaults so unexpected calls don't return undefined and crash tests.
    const prisma = require('@/lib/prisma').prisma;
    prisma.structuredSession.findUnique.mockResolvedValue({ meta: null });
    prisma.structuredSession.update.mockResolvedValue({});
    prisma.question.findMany.mockResolvedValue([]);
    prisma.generatedTest.findFirst.mockResolvedValue(null);
  });

  it('promotes generated practice questions when the question bank is empty', async () => {
    const prisma = require('@/lib/prisma').prisma;

    prisma.question.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'question-1',
          type: 'mcq',
          prompt: 'What is 2 + 2?',
          choices: ['3', '4'],
          difficulty: 'medium',
          correctAnswer: '4',
        },
      ]);
    prisma.generatedQuestion.findMany.mockResolvedValue([
      {
        id: 'generated-1',
        type: 'mcq',
        question: 'What is 2 + 2?',
        options: ['3', '4'],
        answer: '4',
        test: {
          difficulty: 'medium',
          topicId: 'topic-1',
          topic: {
            chapter: {
              name: 'Numbers',
              subject: {
                name: 'Math',
                class: {
                  grade: 7,
                  board: { slug: 'cbse' },
                },
              },
            },
          },
        },
      },
    ]);
    prisma.question.upsert.mockResolvedValue({ id: 'generated-1' });

    const { resolvePhaseContent } = await import('../../../../lib/session/getPhaseContent');
    const result = await resolvePhaseContent('PRACTICE', 'topic-1', 'session-1', 'student-1', null);

    expect(prisma.generatedQuestion.findMany).toHaveBeenCalledWith({
      where: { test: { topicId: 'topic-1', status: { not: 'rejected' } } },
      select: expect.any(Object),
    });
    expect(prisma.question.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        select: expect.objectContaining({
          correctAnswer: true,
        }),
      }),
    );
    expect(prisma.question.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'generated-1' },
        update: {},
        create: expect.objectContaining({
          id: 'generated-1',
          source: 'generated',
          topicId: 'topic-1',
        }),
      }),
    );
    expect(result.type).toBe('practice');
    if (result.type === 'practice') {
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].id).toBe('question-1');
      expect(result.questions[0].correctAnswer).toBe('4');
    }
  });

  it('skips duplicate generated rows during on-demand promotion', async () => {
    const prisma = require('@/lib/prisma').prisma;

    prisma.question.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'existing-1',
          type: 'mcq',
          prompt: 'What is 2 + 2?',
          choices: ['3', '4'],
          difficulty: 'medium',
          correctAnswer: '4',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'existing-1',
          type: 'mcq',
          prompt: 'What is 2 + 2?',
          choices: ['3', '4'],
          difficulty: 'medium',
          correctAnswer: '4',
        },
        {
          id: 'new-1',
          type: 'mcq',
          prompt: 'What is 5 + 5?',
          choices: ['9', '10'],
          difficulty: 'medium',
          correctAnswer: '10',
        },
      ]);

    prisma.generatedQuestion.findMany.mockResolvedValue([
      {
        id: 'gen-dup',
        type: 'mcq',
        question: 'What is 2 + 2?',
        options: ['3', '4'],
        answer: '4',
        test: {
          difficulty: 'medium',
          topicId: 'topic-1',
          topic: {
            chapter: {
              name: 'Numbers',
              subject: {
                name: 'Math',
                class: {
                  grade: 7,
                  board: { slug: 'cbse' },
                },
              },
            },
          },
        },
      },
      {
        id: 'gen-new',
        type: 'mcq',
        question: 'What is 5 + 5?',
        options: ['9', '10'],
        answer: '10',
        test: {
          difficulty: 'medium',
          topicId: 'topic-1',
          topic: {
            chapter: {
              name: 'Numbers',
              subject: {
                name: 'Math',
                class: {
                  grade: 7,
                  board: { slug: 'cbse' },
                },
              },
            },
          },
        },
      },
    ]);

    prisma.question.upsert.mockResolvedValue({ id: 'gen-new' });

    const { resolvePhaseContent } = await import('../../../../lib/session/getPhaseContent');
    const result = await resolvePhaseContent('PRACTICE', 'topic-1', 'session-1', 'student-1', null);

    expect(result.type).toBe('practice');
    expect(prisma.question.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.question.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'gen-new' },
      }),
    );
  });

  it('returns unique practice questions when latest rows contain duplicates', async () => {
    const prisma = require('@/lib/prisma').prisma;

    prisma.question.findMany
      .mockResolvedValueOnce([
        {
          id: 'dup-1',
          type: 'mcq',
          prompt: 'What is 2 + 2?',
          choices: ['3', '4'],
          difficulty: 'medium',
          correctAnswer: '4',
        },
        {
          id: 'dup-2',
          type: 'mcq',
          prompt: 'What is 2 + 2?',
          choices: ['3', '4'],
          difficulty: 'medium',
          correctAnswer: '4',
        },
        {
          id: 'dup-3',
          type: 'mcq',
          prompt: 'What is 2 + 2?',
          choices: ['3', '4'],
          difficulty: 'medium',
          correctAnswer: '4',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'uniq-1',
          type: 'mcq',
          prompt: 'What is 3 + 3?',
          choices: ['5', '6'],
          difficulty: 'easy',
          correctAnswer: '6',
        },
        {
          id: 'uniq-2',
          type: 'mcq',
          prompt: 'What is 7 - 2?',
          choices: ['4', '5'],
          difficulty: 'easy',
          correctAnswer: '5',
        },
        {
          id: 'uniq-3',
          type: 'mcq',
          prompt: 'What is 9 / 3?',
          choices: ['2', '3'],
          difficulty: 'easy',
          correctAnswer: '3',
        },
        {
          id: 'uniq-4',
          type: 'mcq',
          prompt: 'What is 10 - 6?',
          choices: ['3', '4'],
          difficulty: 'easy',
          correctAnswer: '4',
        },
      ]);

    const { resolvePhaseContent } = await import('../../../../lib/session/getPhaseContent');
    const result = await resolvePhaseContent('PRACTICE', 'topic-1', 'session-1', 'student-1', null);

    expect(result.type).toBe('practice');
    if (result.type === 'practice') {
      expect(result.questions).toHaveLength(5);
      expect(new Set(result.questions.map((q) => q.prompt)).size).toBe(5);
      const resultIds = result.questions.map((q) => q.id);
      expect(resultIds).not.toContain('dup-2');
      expect(resultIds).not.toContain('dup-3');
      expect(resultIds).toContain('dup-1');
    }
  });

  it('saves practice question IDs to session meta on first serve', async () => {
    const prisma = require('@/lib/prisma').prisma;

    prisma.question.findMany.mockResolvedValueOnce([
      { id: 'p-1', type: 'mcq', prompt: 'Q1', choices: ['A'], difficulty: 'medium', correctAnswer: 'A' },
      { id: 'p-2', type: 'mcq', prompt: 'Q2', choices: ['B'], difficulty: 'medium', correctAnswer: 'B' },
    ]);

    const { resolvePhaseContent } = await import('../../../../lib/session/getPhaseContent');
    const result = await resolvePhaseContent('PRACTICE', 'topic-1', 'session-1', 'student-1', null);

    expect(result.type).toBe('practice');
    expect(prisma.structuredSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          meta: expect.objectContaining({ servedPracticeIds: expect.arrayContaining(['p-1', 'p-2']) }),
        }),
      }),
    );
  });

  it('returns locked questions from session meta on page refresh (deterministic)', async () => {
    const prisma = require('@/lib/prisma').prisma;

    // Simulate that the session already has saved practice IDs from a prior GET.
    prisma.structuredSession.findUnique.mockResolvedValue({
      meta: { servedPracticeIds: ['locked-1', 'locked-2'] },
    });
    prisma.question.findMany.mockResolvedValue([
      { id: 'locked-1', type: 'mcq', prompt: 'Locked Q1', choices: ['X'], difficulty: 'medium', correctAnswer: 'X' },
      { id: 'locked-2', type: 'mcq', prompt: 'Locked Q2', choices: ['Y'], difficulty: 'easy', correctAnswer: 'Y' },
    ]);

    const { resolvePhaseContent } = await import('../../../../lib/session/getPhaseContent');
    const result = await resolvePhaseContent('PRACTICE', 'topic-1', 'session-1', 'student-1', null);

    expect(result.type).toBe('practice');
    if (result.type === 'practice') {
      expect(result.questions.map((q) => q.id).sort()).toEqual(['locked-1', 'locked-2']);
    }
    // No meta update should happen when returning locked questions.
    expect(prisma.structuredSession.update).not.toHaveBeenCalled();
  });

  it('excludes practice question IDs from the TEST phase (cross-phase dedup)', async () => {
    const prisma = require('@/lib/prisma').prisma;

    // Practice IDs already locked in session meta.
    prisma.structuredSession.findUnique.mockResolvedValue({
      meta: { servedPracticeIds: ['shared-q1', 'shared-q2'] },
    });

    // Test contains 3 questions: 2 overlap with practice, 1 is new.
    prisma.generatedTest.findFirst.mockResolvedValue({
      id: 'test-1',
      title: 'Topic Test',
      difficulty: 'medium',
      questions: [
        { id: 'shared-q1', type: 'mcq', question: 'Shared Q1', options: ['A'], explanation: null },
        { id: 'shared-q2', type: 'mcq', question: 'Shared Q2', options: ['B'], explanation: null },
        { id: 'new-q3', type: 'mcq', question: 'New Q3', options: ['C'], explanation: null },
      ],
    });

    const { resolvePhaseContent } = await import('../../../../lib/session/getPhaseContent');
    const result = await resolvePhaseContent('TEST', 'topic-1', 'session-1', 'student-1', null);

    expect(result.type).toBe('test');
    if (result.type === 'test') {
      const ids = result.questions.map((q) => q.id);
      expect(ids).not.toContain('shared-q1');
      expect(ids).not.toContain('shared-q2');
      expect(ids).toContain('new-q3');
    }
  });

  it('falls back to unfiltered test questions when all would be excluded by practice dedup', async () => {
    const prisma = require('@/lib/prisma').prisma;

    // All test question IDs match practice IDs -- should not return empty test.
    prisma.structuredSession.findUnique.mockResolvedValue({
      meta: { servedPracticeIds: ['q1', 'q2'] },
    });
    prisma.generatedTest.findFirst.mockResolvedValue({
      id: 'test-only',
      title: 'Mini Test',
      difficulty: 'medium',
      questions: [
        { id: 'q1', type: 'mcq', question: 'Q1', options: ['A'], explanation: null },
        { id: 'q2', type: 'mcq', question: 'Q2', options: ['B'], explanation: null },
      ],
    });

    const { resolvePhaseContent } = await import('../../../../lib/session/getPhaseContent');
    const result = await resolvePhaseContent('TEST', 'topic-1', 'session-1', 'student-1', null);

    // All filtered out -- should fall back to all test questions rather than pending.
    expect(result.type).toBe('test');
    if (result.type === 'test') {
      expect(result.questions).toHaveLength(2);
    }
  });
});
