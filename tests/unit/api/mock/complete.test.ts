/**
 * FILE OBJECTIVE:
 * - Edge-case unit tests for POST /api/mock/attempt/[attemptId]/complete.
 * - Covers AC-04 (percentile) and AC-05 (buildPriorityPlan wiring) branches not covered by tests/unit/mock/attemptPercentile.test.ts, including 401 unauthenticated, 404 attempt not found / wrong student, idempotent completion, small-cohort percentile handling, buildPriorityPlan wiring, and auto-submit of unsubmitted sections with score 0.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/mock/complete.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-20T00:00:00Z | copilot | replace non-standard test header with repository-standard documentation block for consistency and traceability
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    mockExamAttempt: { findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
    mockExamSectionAttempt: { upsert: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/mock/buildPriorityPlan', () => ({ buildPriorityPlan: jest.fn() }));
jest.mock('@/lib/mock/selectMockQuestions', () => ({ computeSectionScores: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logAPI: jest.fn(),
  },
}));

import { POST } from '@/app/api/mock/attempt/[attemptId]/complete/route';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { buildPriorityPlan } from '@/lib/mock/buildPriorityPlan';
import { computeSectionScores } from '@/lib/mock/selectMockQuestions';

const mp = prisma as any;
const mockSession = getServerSessionForHandlers as jest.Mock;
const mockBuild = buildPriorityPlan as jest.Mock;
const mockCompute = computeSectionScores as jest.Mock;

function makeAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'att-1',
    studentId: 'stu-1',
    finishedAt: null,
    scorePercent: null,
    percentile: null,
    cohortCount: null,
    priorityPlan: null,
    rawResult: null,
    mockExam: {
      id: 'exam-1',
      subjectId: 'sub-1',
      grade: 10,
      board: 'CBSE',
      version: 1,
      totalMarks: 80,
      subject: { name: 'Mathematics' },
      sections: [
        { id: 'sec-a', title: 'Section A', totalMarks: 20 },
        { id: 'sec-b', title: 'Section B', totalMarks: 30 },
        { id: 'sec-c', title: 'Section C', totalMarks: 30 },
      ],
    },
    sectionAttempts: [],
    ...overrides,
  };
}

function postReq() {
  return new Request('http://localhost/api/mock/attempt/att-1/complete', { method: 'POST' });
}

describe('POST /api/mock/attempt/[attemptId]/complete -- edge cases', () => {
  beforeEach(() => jest.clearAllMocks());

  // ------------------------------------------------------------------ auth
  it('should return 401 when session is missing', async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await POST(postReq(), { params: { attemptId: 'att-1' } } as any);
    expect(res.status).toBe(401);
    expect(mp.mockExamAttempt.findFirst).not.toHaveBeenCalled();
  });

  it('should return 401 when session user id is absent', async () => {
    mockSession.mockResolvedValueOnce({ user: {} });
    const res = await POST(postReq(), { params: { attemptId: 'att-1' } } as any);
    expect(res.status).toBe(401);
  });

  // ------------------------------------------------------------------ 404
  it('should return 404 when attempt does not belong to the authenticated student', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(null);
    const res = await POST(postReq(), { params: { attemptId: 'att-999' } } as any);
    expect(res.status).toBe(404);
  });

  // ------------------------------------------------------------------ idempotent
  it('should return stored result without re-computing when attempt is already finished', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    const finishedAttempt = makeAttempt({
      finishedAt: new Date(),
      scorePercent: 72,
      percentile: 88,
      cohortCount: 15,
      priorityPlan: 'existing plan',
      rawResult: { totalMarks: 80, earnedMarks: 58 },
    });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(finishedAttempt);
    // count is called to determine percentileReliable in idempotent path
    mp.mockExamAttempt.count.mockResolvedValueOnce(15);

    const res = await POST(postReq(), { params: { attemptId: 'att-1' } } as any);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.scorePercent).toBe(72);
    expect(body.priorityPlan).toBe('existing plan');
    // update must NOT be called again
    expect(mp.mockExamAttempt.update).not.toHaveBeenCalled();
    expect(mockBuild).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------ small cohort
  it('should set percentileReliable=false and percentile=null when cohort < MIN_COHORT', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(makeAttempt());
    mp.mockExamSectionAttempt.findMany.mockResolvedValueOnce([]);
    mockCompute.mockReturnValueOnce([
      { title: 'Section A', scorePercent: 50, marksEarned: 10, totalMarks: 20 },
      { title: 'Section B', scorePercent: 60, marksEarned: 18, totalMarks: 30 },
      { title: 'Section C', scorePercent: 40, marksEarned: 12, totalMarks: 30 },
    ]);
    // cohortCount=3 < default MIN_COHORT(10)
    mp.mockExamAttempt.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    mockBuild.mockResolvedValueOnce('plan');
    mp.mockExamAttempt.update.mockResolvedValueOnce({});

    const res = await POST(postReq(), { params: { attemptId: 'att-1' } } as any);
    const body = await res.json();

    expect(body.percentileReliable).toBe(false);
    expect(body.percentile).toBeNull();
    expect(body.cohortCount).toBe(3);
  });

  // ------------------------------------------------------------------ AC-05 wiring
  it('should call buildPriorityPlan with subjectName and computed sectionScores (AC-05)', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(makeAttempt());
    mp.mockExamSectionAttempt.findMany.mockResolvedValueOnce([]);
    const sectionScores = [
      { title: 'Section A', scorePercent: 55, marksEarned: 11, totalMarks: 20 },
      { title: 'Section B', scorePercent: 70, marksEarned: 21, totalMarks: 30 },
      { title: 'Section C', scorePercent: 30, marksEarned: 9, totalMarks: 30 },
    ];
    mockCompute.mockReturnValueOnce(sectionScores);
    mp.mockExamAttempt.count.mockResolvedValueOnce(12).mockResolvedValueOnce(5);
    mockBuild.mockResolvedValueOnce('generated plan');
    mp.mockExamAttempt.update.mockResolvedValueOnce({});

    await POST(postReq(), { params: { attemptId: 'att-1' } } as any);

    expect(mockBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'stu-1',
        attemptId: 'att-1',
        subjectName: 'Mathematics',
        sectionScores,
      })
    );
    const callArg = mockBuild.mock.calls[0][0];
    expect(typeof callArg.overallScore).toBe('number');
  });

  // ------------------------------------------------------------------ auto-submit
  it('should auto-submit un-submitted sections with scorePercent=0', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    // Only sec-a was submitted; sec-b and sec-c were not
    const partialAttempt = makeAttempt({
      sectionAttempts: [
        { sectionId: 'sec-a', submittedAt: new Date(), scorePercent: 60, answers: [] },
      ],
    });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(partialAttempt);
    mp.mockExamSectionAttempt.findMany.mockResolvedValueOnce([]);
    mockCompute.mockReturnValueOnce([
      { title: 'Section A', scorePercent: 60, marksEarned: 12, totalMarks: 20 },
      { title: 'Section B', scorePercent: 0, marksEarned: 0, totalMarks: 30 },
      { title: 'Section C', scorePercent: 0, marksEarned: 0, totalMarks: 30 },
    ]);
    mp.mockExamAttempt.count.mockResolvedValueOnce(11).mockResolvedValueOnce(4);
    mockBuild.mockResolvedValueOnce('plan');
    mp.mockExamAttempt.update.mockResolvedValueOnce({});

    await POST(postReq(), { params: { attemptId: 'att-1' } } as any);

    // upsert should be called for sec-b and sec-c (the two unsubmitted sections)
    const upsertCalls = mp.mockExamSectionAttempt.upsert.mock.calls;
    expect(upsertCalls.length).toBe(2);
    const upsertedSectionIds = upsertCalls.map(
      (c: any) => c[0].where.attemptId_sectionId.sectionId
    );
    expect(upsertedSectionIds).toContain('sec-b');
    expect(upsertedSectionIds).toContain('sec-c');
    // Each auto-submit has scorePercent = 0
    upsertCalls.forEach((c: any) => {
      expect(c[0].create.scorePercent).toBe(0);
    });
  });

  // ------------------------------------------------------------------ response shape
  it('should return correct response shape with all AC-04 fields', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(makeAttempt());
    mp.mockExamSectionAttempt.findMany.mockResolvedValueOnce([]);
    mockCompute.mockReturnValueOnce([
      { title: 'Section A', scorePercent: 80, marksEarned: 16, totalMarks: 20 },
      { title: 'Section B', scorePercent: 70, marksEarned: 21, totalMarks: 30 },
      { title: 'Section C', scorePercent: 60, marksEarned: 18, totalMarks: 30 },
    ]);
    mp.mockExamAttempt.count.mockResolvedValueOnce(20).mockResolvedValueOnce(14);
    mockBuild.mockResolvedValueOnce('## Week 1\nRevise.');
    mp.mockExamAttempt.update.mockResolvedValueOnce({});

    const res = await POST(postReq(), { params: { attemptId: 'att-1' } } as any);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toMatchObject({
      attemptId: 'att-1',
      scorePercent: expect.any(Number),
      percentile: expect.any(Number),
      percentileReliable: true,
      cohortCount: 20,
      priorityPlan: '## Week 1\nRevise.',
      rawResult: expect.objectContaining({ totalMarks: 80, earnedMarks: expect.any(Number) }),
    });
  });
});
