/**
 * FILE OBJECTIVE:
 * - Unit tests for GET /api/student/learning-plan/timeline
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/learningPlan.timeline.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | add timeline API unit tests
 */

// Mock dependencies before importing the route
jest.mock('@/lib/prisma', () => ({
  prisma: {
    learningPlan: { findFirst: jest.fn() },
    learningPlanItem: { findMany: jest.fn() },
    subjectDef: { findUnique: jest.fn() },
  },
}));

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { logAPI: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { GET } from '@/app/api/student/learning-plan/timeline/route';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

const mockPrisma = prisma as unknown as {
  learningPlan: { findFirst: jest.Mock };
  learningPlanItem: { findMany: jest.Mock };
  subjectDef: { findUnique: jest.Mock };
};

const mockGetSession = getServerSessionForHandlers as jest.Mock;

describe('GET /api/student/learning-plan/timeline', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = new Request('http://localhost/api/student/learning-plan/timeline');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 404 when no plan exists', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockPrisma.learningPlan.findFirst.mockResolvedValue(null);

    const req = new Request('http://localhost/api/student/learning-plan/timeline');
    const res = await GET(req as any);
    expect(res.status).toBe(404);
  });

  it('returns timeline payload with isMandatory true when chapter has board weight', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });

    const plan = {
      id: 'plan-1',
      subjectId: 'sub-1',
      examDate: new Date('2026-06-01'),
      weeklyGoal: 3,
      generatedAt: new Date('2026-04-01'),
    };

    mockPrisma.learningPlan.findFirst.mockResolvedValue(plan);

    // One mandatory item (chapter weightMarks=10) and one optional
    mockPrisma.learningPlanItem.findMany.mockResolvedValue([
      {
        id: 'i1',
        conceptId: 'c1',
        weekNumber: 1,
        orderInWeek: 0,
        status: 'UPCOMING',
        concept: {
          name: 'Concept 1',
          topic: {
            chapter: { id: 'ch1', name: 'Chapter 1', boardChapterWeights: [{ weightMarks: 10 }] },
          },
        },
      },
      {
        id: 'i2',
        conceptId: 'c2',
        weekNumber: 1,
        orderInWeek: 1,
        status: 'UPCOMING',
        concept: {
          name: 'Concept 2',
          topic: { chapter: { id: 'ch2', name: 'Chapter 2', boardChapterWeights: [] } },
        },
      },
    ]);

    mockPrisma.subjectDef.findUnique.mockResolvedValue({ name: 'Maths' });

    const req = new Request('http://localhost/api/student/learning-plan/timeline');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.planId).toBe(plan.id);
    expect(body.weeks.length).toBeGreaterThan(0);
    const items = body.weeks[0].items;
    const first = items.find((i: any) => i.id === 'i1');
    const second = items.find((i: any) => i.id === 'i2');
    expect(first.isMandatory).toBe(true);
    expect(second.isMandatory).toBe(false);
  });
});
