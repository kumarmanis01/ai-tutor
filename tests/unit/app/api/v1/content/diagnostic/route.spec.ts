/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/v1/content/diagnostic to ensure no answer key leakage.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/content/diagnostic/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T13:45:00Z | copilot | add test asserting correctAnswer is never exposed in public diagnostic payload
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    question: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    logAPI: jest.fn(),
    error: jest.fn(),
  },
}));

import { GET } from '@/app/api/v1/content/diagnostic/route';
import { prisma } from '@/lib/prisma';

const mockFindMany = prisma.question.findMany as jest.MockedFunction<typeof prisma.question.findMany>;

describe('GET /api/v1/content/diagnostic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns diagnostic questions without correctAnswer field', async () => {
    mockFindMany
      .mockResolvedValueOnce([
        {
          id: 'q-1',
          prompt: 'Question 1',
          choices: ['A', 'B', 'C', 'D'],
          subject: 'Mathematics',
          grade: '5',
        },
        {
          id: 'q-2',
          prompt: 'Question 2',
          choices: ['A', 'B', 'C', 'D'],
          subject: 'Science',
          grade: '5',
        },
      ] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const req = new Request('http://localhost/api/v1/content/diagnostic?grade=5&board=CBSE', {
      method: 'GET',
    });

    const res = await GET(req);
    const body = (await res.json()) as { ok: boolean; questions: Array<Record<string, unknown>> };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.questions.length).toBeGreaterThan(0);
    expect(body.questions[0]).not.toHaveProperty('correctAnswer');
  });
});
