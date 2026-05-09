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
 */

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
  });

  it('promotes generated practice questions when the question bank is empty', async () => {
    const prisma = require('@/lib/prisma').prisma;

    prisma.question.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'question-1',
          type: 'mcq',
          prompt: 'What is 2 + 2?',
          choices: ['3', '4'],
          difficulty: 'medium',
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

    const { resolvePhaseContent } = await import('@/lib/session/getPhaseContent');
    const result = await resolvePhaseContent('PRACTICE', 'topic-1', 'session-1', 'student-1', null);

    expect(prisma.generatedQuestion.findMany).toHaveBeenCalledWith({
      where: { test: { topicId: 'topic-1', status: { not: 'rejected' } } },
      select: expect.any(Object),
    });
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
    }
  });
});
