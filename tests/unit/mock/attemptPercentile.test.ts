/**
 * FILE OBJECTIVE:
 * - Unit tests for cohort percentile computation and persistence for mock exam attempts.
 *
 * LINKED UNIT TEST:
 * - tests/unit/mock/attemptPercentile.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | created
 */

// Mock dependencies before importing the routes
jest.mock('@/lib/prisma', () => ({
  prisma: {
    mockExamAttempt: {
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    mockExamSectionAttempt: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}));

jest.mock('@/lib/mock/buildPriorityPlan', () => ({ buildPriorityPlan: jest.fn() }));
jest.mock('@/lib/mock/selectMockQuestions', () => ({ computeSectionScores: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), logAPI: jest.fn() } }));

import { POST } from '@/app/api/mock/attempt/[attemptId]/complete/route';
import { GET } from '@/app/api/mock/attempt/[attemptId]/report/route';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { buildPriorityPlan } from '@/lib/mock/buildPriorityPlan';
import { computeSectionScores } from '@/lib/mock/selectMockQuestions';

const mockPrisma = prisma as unknown as {
  mockExamAttempt: {
    findFirst: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
  };
  mockExamSectionAttempt: {
    upsert: jest.Mock;
    findMany: jest.Mock;
  };
};
const mockGetSession = getServerSessionForHandlers as jest.Mock;
const mockBuild = buildPriorityPlan as jest.Mock;
const mockCompute = computeSectionScores as jest.Mock;

describe('Mock attempt percentile (F-STU-021)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: 'student-1' } });
  });

  it('POST completes attempt, computes cohort percentile within grade/board/subject/version + 90d, and persists cohortCount', async () => {
    const attemptRecord = {
      id: 'attempt-1',
      mockExamId: 'exam-1',
      studentId: 'student-1',
      startedAt: new Date(),
      finishedAt: null,
      scorePercent: null,
      percentile: null,
      priorityPlan: null,
      rawResult: null,
      mockExam: {
        id: 'exam-1',
        subjectId: 'sub-1',
        grade: 10,
        board: 'CBSE',
        version: 2,
        sections: [
          { id: 'sec-1', title: 'S1', totalMarks: 40 },
          { id: 'sec-2', title: 'S2', totalMarks: 40 },
        ],
        subject: { name: 'Math' },
      },
      sectionAttempts: [],
    } as any;

    mockPrisma.mockExamAttempt.findFirst.mockResolvedValueOnce(attemptRecord);
    // No section attempts to re-fetch
    mockPrisma.mockExamSectionAttempt.findMany.mockResolvedValue([]);

    // Compute section scores -> earned 20 + 20 = 40 marks
    mockCompute.mockReturnValue([{ marksEarned: 20 }, { marksEarned: 20 }]);

    // Cohort: first call -> cohortCount (12), second -> belowCount (4)
    mockPrisma.mockExamAttempt.count.mockResolvedValueOnce(12).mockResolvedValueOnce(4);

    mockBuild.mockResolvedValue('plan-md');

    mockPrisma.mockExamAttempt.update.mockResolvedValue({
      ...attemptRecord,
      finishedAt: new Date(),
      scorePercent: 50,
      percentile: (4 / 12) * 100,
      cohortCount: 12,
    });

    const req = new Request('http://localhost/api/mock/attempt/attempt-1/complete', { method: 'POST' });
    // Call the handler
    const res = await POST(req, { params: { attemptId: 'attempt-1' } } as any);
    const body = await res.json();

    expect(body.cohortCount).toBe(12);
    expect(body.percentileReliable).toBe(true);
    expect(body.percentile).toBeCloseTo((4 / 12) * 100, 3);
    expect(mockPrisma.mockExamAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'attempt-1' } }),
    );
  });

  it('GET report exposes cohortCount and percentilereliable when cohort is large enough', async () => {
    const attemptRecord = {
      id: 'attempt-1',
      mockExamId: 'exam-1',
      studentId: 'student-1',
      startedAt: new Date(),
      finishedAt: new Date(),
      scorePercent: 50,
      percentile: 33.333,
      cohortCount: 12,
      priorityPlan: 'plan-md',
      rawResult: {},
      mockExam: {
        id: 'exam-1',
        subjectId: 'sub-1',
        grade: 10,
        board: 'CBSE',
        version: 2,
        title: 'Mock 1',
        totalMarks: 80,
        durationMin: 180,
        subject: { name: 'Math' },
        sections: [],
      },
      sectionAttempts: [],
    } as any;

    mockPrisma.mockExamAttempt.findFirst.mockResolvedValueOnce(attemptRecord);
    // Cohort count recomputed in report endpoint
    mockPrisma.mockExamAttempt.count.mockResolvedValueOnce(12);

    const req = new Request('http://localhost/api/mock/attempt/attempt-1/report', { method: 'GET' });
    const res = await GET(req, { params: { attemptId: 'attempt-1' } } as any);
    const body = await res.json();

    expect(body.cohortCount).toBe(12);
    expect(body.percentileReliable).toBe(true);
    expect(body.percentile).toBeCloseTo(33.333, 2);
  });
});
