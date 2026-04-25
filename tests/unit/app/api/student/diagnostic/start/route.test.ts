/**
 * FILE OBJECTIVE:
 * - Unit tests for the retake / question-exclusion branch in
 *   POST /api/student/diagnostic/start route.
 *   Verifies that when a student is eligible for a retake and a previous runId
 *   exists, answerEvent.findMany is called with the previous runId and
 *   generateSubjectDiagnosticTest is re-invoked with the computed exclusion set.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/diagnostic/start/route.test.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | created — addresses PR review comment on missing retake branch coverage
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetServerSession = jest.fn();
const mockGenerateTest = jest.fn();
const mockGetStatus = jest.fn();
const mockUpsertStatus = jest.fn();
const mockCreateSession = jest.fn();
const mockEnqueueAutoSubmit = jest.fn();
const mockAnswerEventFindMany = jest.fn();

jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: mockGetServerSession }));
jest.mock('@/lib/diagnostics/diagnosticQuestionService', () => ({
  generateSubjectDiagnosticTest: mockGenerateTest,
}));
jest.mock('@/lib/diagnostics/stateStore', () => ({
  getSubjectDiagnosticStatus: mockGetStatus,
  upsertSubjectDiagnosticStatus: mockUpsertStatus,
}));
jest.mock('@/lib/diagnostics/sessionStore', () => ({ createSession: mockCreateSession }));
jest.mock('@/jobs/diagnosticAutoSubmit', () => ({
  enqueueDiagnosticAutoSubmit: mockEnqueueAutoSubmit,
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logAPI: jest.fn() },
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    answerEvent: { findMany: mockAnswerEventFindMany },
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIRST_QUESTION = {
  id: 'q-1',
  questionText: 'What is 2+2?',
  options: ['1', '2', '3', '4'],
  correctAnswer: '3',
  topicId: 'topic-1',
  difficulty: 'easy',
};

const DIAGNOSTIC_TEST = {
  subjectId: 'subj-1',
  subjectName: 'Math',
  boardSlug: 'cbse',
  grade: 9,
  questions: [FIRST_QUESTION],
};

function makeRequest(body: object): Request {
  return {
    json: async () => body,
  } as unknown as Request;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/student/diagnostic/start — retake question exclusion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'student-1' } });
    mockGenerateTest.mockResolvedValue(DIAGNOSTIC_TEST);
    mockUpsertStatus.mockResolvedValue(undefined);
    mockCreateSession.mockResolvedValue(undefined);
    mockEnqueueAutoSubmit.mockResolvedValue(undefined);
  });

  it('calls answerEvent.findMany with the previous runId when eligible for retake', async () => {
    const PREV_RUN_ID = 'prev-sess-123';
    // Completed 60 days ago — eligible for retake (> 30-day cooldown)
    const completedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    mockGetStatus.mockResolvedValue({
      status: 'completed',
      completedAt,
      runId: PREV_RUN_ID,
    });
    mockAnswerEventFindMany.mockResolvedValue([
      { questionId: 'old-q-1' },
      { questionId: 'old-q-2' },
    ]);

    const { POST } = await import('@/app/api/student/diagnostic/start/route');
    await POST(makeRequest({ boardSlug: 'cbse', grade: 9, subjectSlug: 'mathematics' }));

    expect(mockAnswerEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: 'student-1', sessionId: PREV_RUN_ID }),
      })
    );
  });

  it('re-invokes generateSubjectDiagnosticTest with the exclusion set when prior question IDs exist', async () => {
    const PREV_RUN_ID = 'prev-sess-456';
    const completedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    mockGetStatus.mockResolvedValue({
      status: 'completed',
      completedAt,
      runId: PREV_RUN_ID,
    });
    mockAnswerEventFindMany.mockResolvedValue([
      { questionId: 'old-q-1' },
      { questionId: 'old-q-2' },
      { questionId: null }, // null entries must be filtered out
    ]);

    const { POST } = await import('@/app/api/student/diagnostic/start/route');
    await POST(makeRequest({ boardSlug: 'cbse', grade: 9, subjectSlug: 'mathematics' }));

    // First call is the initial test (no exclusions), second is the retake call
    expect(mockGenerateTest).toHaveBeenCalledTimes(2);
    const [_firstCallArgs, secondCallArgs] = mockGenerateTest.mock.calls;
    const exclusionSet: Set<string> = secondCallArgs[1];
    expect(exclusionSet).toBeInstanceOf(Set);
    expect(exclusionSet.has('old-q-1')).toBe(true);
    expect(exclusionSet.has('old-q-2')).toBe(true);
    // Null was filtered, so the set size should be exactly 2
    expect(exclusionSet.size).toBe(2);
  });

  it('does NOT re-invoke generateSubjectDiagnosticTest when no prior question IDs exist', async () => {
    const PREV_RUN_ID = 'prev-sess-789';
    const completedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    mockGetStatus.mockResolvedValue({
      status: 'completed',
      completedAt,
      runId: PREV_RUN_ID,
    });
    // Previous session has no answer events
    mockAnswerEventFindMany.mockResolvedValue([]);

    const { POST } = await import('@/app/api/student/diagnostic/start/route');
    await POST(makeRequest({ boardSlug: 'cbse', grade: 9, subjectSlug: 'mathematics' }));

    // Only one call — the initial test; no exclusion-based regeneration
    expect(mockGenerateTest).toHaveBeenCalledTimes(1);
  });

  it('does NOT call answerEvent.findMany when no previous runId is present', async () => {
    const completedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    mockGetStatus.mockResolvedValue({
      status: 'completed',
      completedAt,
      runId: null, // No previous runId
    });

    const { POST } = await import('@/app/api/student/diagnostic/start/route');
    await POST(makeRequest({ boardSlug: 'cbse', grade: 9, subjectSlug: 'mathematics' }));

    expect(mockAnswerEventFindMany).not.toHaveBeenCalled();
    expect(mockGenerateTest).toHaveBeenCalledTimes(1);
  });

  it('proceeds with the original test when answerEvent.findMany throws', async () => {
    const PREV_RUN_ID = 'prev-sess-err';
    const completedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    mockGetStatus.mockResolvedValue({ status: 'completed', completedAt, runId: PREV_RUN_ID });
    mockAnswerEventFindMany.mockRejectedValue(new Error('DB connection lost'));

    const { POST } = await import('@/app/api/student/diagnostic/start/route');
    const res = await POST(
      makeRequest({ boardSlug: 'cbse', grade: 9, subjectSlug: 'mathematics' })
    );

    // The error is caught internally; session creation still proceeds
    expect(res.status).toBe(200);
    expect(mockCreateSession).toHaveBeenCalled();
  });
});
