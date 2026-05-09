/**
 * FILE OBJECTIVE:
 * - Unit tests for rejecting generated tests and cascading the rejection to
 *   promoted student-facing question rows.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/tests/[id]/reject.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | add coverage for generated-test rejection cascade and not-found handling
 */

describe('POST /api/admin/tests/[id]/reject', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('rejects the generated test and cascades rejection to promoted questions', async () => {
    const enqueueQuestionsHydration = jest.fn().mockResolvedValue({ created: true, jobId: 'job-1' });
    const generatedQuestionFindMany = jest.fn().mockResolvedValue([{ id: 'question-1' }, { id: 'question-2' }]);
    const generatedTestFindUnique = jest.fn().mockResolvedValue({
      id: 'test-1',
      status: 'approved',
      topicId: 'topic-1',
      language: 'en',
      difficulty: 'medium',
    });
    const generatedTestUpdate = jest.fn();
    const questionUpdateMany = jest.fn();
    const auditLogCreate = jest.fn();
    const userFindUnique = jest.fn().mockResolvedValue({ id: 'admin-1' });
    const transaction = jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'admin-1', email: 'admin@example.com' } })),
    }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: userFindUnique },
        generatedTest: {
          findUnique: generatedTestFindUnique,
          update: generatedTestUpdate,
        },
        generatedQuestion: {
          findMany: generatedQuestionFindMany,
        },
        question: {
          updateMany: questionUpdateMany,
        },
        auditLog: {
          create: auditLogCreate,
        },
        $transaction: transaction,
      },
    }));
    jest.doMock('@/lib/logger', () => ({
      logger: { add: jest.fn(), info: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/lib/execution-pipeline/enqueueTopicHydration', () => ({
      enqueueQuestionsHydration,
    }));
    jest.doMock('@/lib/ai-engine/types', () => ({
      ApprovalStatus: { Rejected: 'rejected' },
    }));
    jest.doMock('@prisma/client', () => ({
      QuestionStatus: { REJECTED: 'REJECTED' },
    }));

    const { POST } = await import('@/app/api/admin/tests/[id]/reject');
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ reason: 'content mismatch' }),
      }) as any,
      { params: Promise.resolve({ id: 'test-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rejected).toBe(true);
    expect(generatedQuestionFindMany).toHaveBeenCalledWith({
      where: { testId: 'test-1' },
      select: { id: true },
    });
    expect(questionUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['question-1', 'question-2'] } },
      data: { status: 'REJECTED' },
    });
    expect(enqueueQuestionsHydration).toHaveBeenCalledWith({
      topicId: 'topic-1',
      language: 'en',
      difficulty: 'medium',
    });
  });

  it('returns 404 when the generated test does not exist', async () => {
    const generatedQuestionFindMany = jest.fn();

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'admin-1', email: 'admin@example.com' } })),
    }));
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1' }) },
        generatedTest: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        generatedQuestion: {
          findMany: generatedQuestionFindMany,
        },
        question: {
          updateMany: jest.fn(),
        },
        auditLog: {
          create: jest.fn(),
        },
        $transaction: jest.fn(),
      },
    }));
    jest.doMock('@/lib/logger', () => ({
      logger: { add: jest.fn(), info: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/lib/execution-pipeline/enqueueTopicHydration', () => ({
      enqueueQuestionsHydration: jest.fn(),
    }));
    jest.doMock('@/lib/ai-engine/types', () => ({
      ApprovalStatus: { Rejected: 'rejected' },
    }));
    jest.doMock('@prisma/client', () => ({
      QuestionStatus: { REJECTED: 'REJECTED' },
    }));

    const { POST } = await import('@/app/api/admin/tests/[id]/reject');
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ reason: 'missing test' }),
      }) as any,
      { params: Promise.resolve({ id: 'missing-test' }) },
    );

    expect(response.status).toBe(404);
    expect(generatedQuestionFindMany).not.toHaveBeenCalled();
  });
});
