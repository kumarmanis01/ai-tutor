/**
 * FILE OBJECTIVE:
 * - Validate edge-case behavior for GET /api/mock/attempt/[attemptId]/report, including authentication failures, missing attempts, small-cohort percentile suppression, per-question time heatmap mapping, and priority-plan payload wiring.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/mock/report.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-20T00:00:00Z | copilot | replace ad-hoc test comment with standard repository header block to satisfy CodeQL/header policy
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    mockExamAttempt: { findFirst: jest.fn(), count: jest.fn() },
  },
}));
jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() },
}));

import { GET } from '@/app/api/mock/attempt/[attemptId]/report/route';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

const mp = prisma as any;
const mockSession = getServerSessionForHandlers as jest.Mock;

function getReq() {
  return new Request('http://localhost/api/mock/attempt/att-1/report', { method: 'GET' });
}

function makeAttemptRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'att-1',
    studentId: 'stu-1',
    startedAt: new Date('2026-04-01T09:00:00Z'),
    finishedAt: new Date('2026-04-01T12:00:00Z'),
    scorePercent: 68,
    percentile: 72.5,
    cohortCount: 20,
    priorityPlan: '## Week 1\n- Revise Section C',
    rawResult: {},
    mockExam: {
      title: 'Math Full Mock -- Paper 1',
      totalMarks: 80,
      durationMin: 180,
      grade: 10,
      board: 'CBSE',
      version: 1,
      subjectId: 'sub-1',
      subject: { name: 'Mathematics' },
      sections: [
        {
          id: 'sec-a',
          title: 'Section A',
          order: 1,
          totalMarks: 20,
          instructions: 'MCQ section',
          questions: [
            {
              id: 'meq-1',
              marks: 1,
              order: 1,
              question: { id: 'q-1', type: 'mcq', prompt: 'What is 2+2?', correctAnswer: '4' },
            },
            {
              id: 'meq-2',
              marks: 1,
              order: 2,
              question: { id: 'q-2', type: 'mcq', prompt: 'What is 3x3?', correctAnswer: '9' },
            },
          ],
        },
      ],
    },
    sectionAttempts: [
      {
        sectionId: 'sec-a',
        scorePercent: 100,
        submittedAt: new Date('2026-04-01T10:00:00Z'),
        answers: [
          { questionId: 'q-1', answer: '4', timeSpentSeconds: 45 },
          { questionId: 'q-2', answer: '9', timeSpentSeconds: 90 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('GET /api/mock/attempt/[attemptId]/report -- edge cases (AC-04)', () => {
  beforeEach(() => jest.clearAllMocks());

  // ------------------------------------------------------------------ auth
  it('should return 401 when session is missing', async () => {
    mockSession.mockResolvedValueOnce(null);
    const res = await GET(getReq(), { params: { attemptId: 'att-1' } } as any);
    expect(res.status).toBe(401);
    expect(mp.mockExamAttempt.findFirst).not.toHaveBeenCalled();
  });

  it('should return 401 when session has no user id', async () => {
    mockSession.mockResolvedValueOnce({ user: {} });
    const res = await GET(getReq(), { params: { attemptId: 'att-1' } } as any);
    expect(res.status).toBe(401);
  });

  // ------------------------------------------------------------------ 404
  it('should return 404 when attempt is not found for student', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(null);
    const res = await GET(getReq(), { params: { attemptId: 'att-999' } } as any);
    expect(res.status).toBe(404);
  });

  // ------------------------------------------------------------------ time heatmap (AC-04)
  it('should return per-question timeSpentSeconds in section detail (heatmap)', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(makeAttemptRecord());
    mp.mockExamAttempt.count.mockResolvedValueOnce(20);

    const res = await GET(getReq(), { params: { attemptId: 'att-1' } } as any);
    expect(res.status).toBe(200);
    const body = await res.json();

    const sectionA = body.sections[0];
    expect(sectionA.questions[0].timeSpentSeconds).toBe(45);
    expect(sectionA.questions[1].timeSpentSeconds).toBe(90);
  });

  it('should default timeSpentSeconds to 0 for questions not in submitted answers', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    // Section attempt with empty answers array
    const attempt = makeAttemptRecord({
      sectionAttempts: [
        { sectionId: 'sec-a', scorePercent: 0, submittedAt: new Date(), answers: [] },
      ],
    });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(attempt);
    mp.mockExamAttempt.count.mockResolvedValueOnce(20);

    const res = await GET(getReq(), { params: { attemptId: 'att-1' } } as any);
    const body = await res.json();

    body.sections[0].questions.forEach((q: any) => {
      expect(q.timeSpentSeconds).toBe(0);
    });
  });

  // ------------------------------------------------------------------ small cohort (AC-04)
  it('should hide percentile when cohortCount < MIN_COHORT', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(makeAttemptRecord());
    // cohortCount=5 < default MIN_COHORT(10)
    mp.mockExamAttempt.count.mockResolvedValueOnce(5);

    const res = await GET(getReq(), { params: { attemptId: 'att-1' } } as any);
    const body = await res.json();

    expect(body.percentileReliable).toBe(false);
    expect(body.percentile).toBeNull();
    expect(body.cohortCount).toBe(5);
  });

  it('should expose percentile when cohortCount >= MIN_COHORT', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(makeAttemptRecord());
    mp.mockExamAttempt.count.mockResolvedValueOnce(25);

    const res = await GET(getReq(), { params: { attemptId: 'att-1' } } as any);
    const body = await res.json();

    expect(body.percentileReliable).toBe(true);
    expect(body.percentile).toBeCloseTo(72.5, 1);
    expect(body.cohortCount).toBe(25);
  });

  // ------------------------------------------------------------------ AC-05 in report
  it('should include AI priorityPlan in report response', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(makeAttemptRecord());
    mp.mockExamAttempt.count.mockResolvedValueOnce(20);

    const res = await GET(getReq(), { params: { attemptId: 'att-1' } } as any);
    const body = await res.json();

    expect(body.priorityPlan).toBe('## Week 1\n- Revise Section C');
  });

  // ------------------------------------------------------------------ section-wise breakdown (AC-04)
  it('should return section title, marks, scorePercent and submittedAnswer per question', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(makeAttemptRecord());
    mp.mockExamAttempt.count.mockResolvedValueOnce(20);

    const res = await GET(getReq(), { params: { attemptId: 'att-1' } } as any);
    const body = await res.json();

    const sec = body.sections[0];
    expect(sec.title).toBe('Section A');
    expect(sec.totalMarks).toBe(20);
    expect(sec.scorePercent).toBe(100);
    expect(sec.marksEarned).toBe(20);

    const q1 = sec.questions[0];
    expect(q1.prompt).toBe('What is 2+2?');
    expect(q1.correctAnswer).toBe('4');
    expect(q1.submittedAnswer).toBe('4');
    expect(q1.marks).toBe(1);
  });

  // ------------------------------------------------------------------ exam metadata
  it('should return exam title, subjectName, totalMarks, scorePercent', async () => {
    mockSession.mockResolvedValueOnce({ user: { id: 'stu-1' } });
    mp.mockExamAttempt.findFirst.mockResolvedValueOnce(makeAttemptRecord());
    mp.mockExamAttempt.count.mockResolvedValueOnce(20);

    const res = await GET(getReq(), { params: { attemptId: 'att-1' } } as any);
    const body = await res.json();

    expect(body.examTitle).toBe('Math Full Mock -- Paper 1');
    expect(body.subjectName).toBe('Mathematics');
    expect(body.totalMarks).toBe(80);
    expect(body.scorePercent).toBe(68);
    expect(body.attemptId).toBe('att-1');
  });
});
