/**
 * Pipeline integration test: diagnosticAutoSubmitWorker -> diagnosticBootstrapWorker
 *
 * Tests the chained flow where auto-submit processes partial Redis state,
 * writes AnswerEvents, enqueues a bootstrap job, and then the bootstrap
 * worker seeds StudentConceptState. All external deps are mocked so this
 * runs safely in CI without a live DB or Redis.
 *
 * For end-to-end DB tests see tests/integration/ (manual-only, requires live DB).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeAutoSubmitJob(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'auto-job-1',
    data: { userId: 'user-1', subjectId: 'subj-1', sessionId: 'sess-1', ...overrides },
  };
}

function makeBootstrapJob(data: Record<string, unknown>): any {
  return { id: 'bootstrap-job-1', data };
}

describe('Diagnostic pipeline: auto-submit -> bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should write AnswerEvents, enqueue bootstrap with covered chapters, and seed concepts for a full run (>= 10 answers)', async () => {
    const partialAnswers = Array.from({ length: 10 }, (_, i) => ({
      questionId: `q${i}`,
      selectedOption: 'A',
    }));

    const questions = partialAnswers.map((a, i) => ({
      id: a.questionId,
      correctAnswer: 'A',
      choices: null,
      topicId: `topic-${i % 3}`,
    }));

    const createManyMock = jest.fn(async () => ({ count: 10 }));
    const createConceptStateMock = jest.fn(async () => ({}));
    const enqueueMock = jest.fn(async () => {});
    const clearPartialMock = jest.fn(async () => {});
    const upsertStatusMock = jest.fn(async () => {});

    const prismaMock: any = {
      question: { findMany: jest.fn(async () => questions) },
      concept: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { id: 'concept-0', topicId: 'topic-0' },
            { id: 'concept-1', topicId: 'topic-1' },
            { id: 'concept-2', topicId: 'topic-2' },
          ])
          .mockResolvedValueOnce([
            { id: 'concept-0', irt_b: 0.0, bloomLevel: 'apply' },
            { id: 'concept-1', irt_b: 0.5, bloomLevel: 'remember' },
            { id: 'concept-2', irt_b: -0.5, bloomLevel: 'understand' },
          ]),
      },
      answerEvent: {
        createMany: createManyMock,
        findMany: jest.fn(async () =>
          Array.from({ length: 10 }, (_, i) => ({
            conceptId: `concept-${i % 3}`,
            isCorrect: true,
          }))
        ),
      },
      topicDef: {
        findMany: jest.fn(async () =>
          Array.from({ length: 3 }, (_, i) => ({ id: `topic-${i}`, chapterId: 'chap-1' }))
        ),
      },
      chapterDef: {
        findMany: jest.fn(async () => [{ id: 'chap-1' }]),
        findUnique: jest.fn(async () => ({ subjectId: 'subj-1' })),
      },
      user: { findUnique: jest.fn(async () => ({ board: 'CBSE' })) },
      subjectDef: { findUnique: jest.fn(async () => ({ class: { id: 'class-1' } })) },
      studentConceptState: {
        findUnique: jest.fn(async () => null),
        create: createConceptStateMock,
        update: jest.fn(async () => ({})),
      },
      learningPlanItem: { count: jest.fn(async () => 5) },
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/prisma.js', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/lib/logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/lib/redis/diagnosticPartial.js', () => ({
      getPartialDiagnostic: jest.fn(async () => ({ answers: partialAnswers })),
      clearPartialDiagnostic: clearPartialMock,
    }));
    jest.doMock('@/jobs/diagnosticBootstrap.js', () => ({
      enqueueDiagnosticBootstrapJob: enqueueMock,
    }));
    jest.doMock('@/lib/diagnostics/stateStore.js', () => ({
      getSubjectDiagnosticStatus: jest.fn(async () => ({ status: 'in_progress' })),
      upsertSubjectDiagnosticStatus: upsertStatusMock,
    }));
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 10 } }));
    jest.doMock('@/lib/ai/learningPlan.js', () => ({
      generateLearningPlan: jest.fn(async () => 'plan-1'),
    }));

    const { processDiagnosticAutoSubmit } =
      await import('@/worker/services/diagnosticAutoSubmitWorker');
    await processDiagnosticAutoSubmit(makeAutoSubmitJob());

    // Should have written 10 AnswerEvents tagged as 'diagnostic'
    expect(createManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ source: 'diagnostic' })]),
      })
    );

    // Full run: bootstrap should target only the chapters covered by the diagnostic
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({ chapterIds: ['chap-1'] }));
    // Should clean Redis and mark completed
    expect(clearPartialMock).toHaveBeenCalled();
    expect(upsertStatusMock).toHaveBeenCalledWith(
      'user-1',
      'subj-1',
      expect.objectContaining({ status: 'completed' })
    );

    // Chain: run bootstrap with the job data that auto-submit enqueued
    const bootstrapData = enqueueMock.mock.calls[0][0];
    const { processDiagnosticBootstrap } =
      await import('@/worker/services/diagnosticBootstrapWorker');
    await processDiagnosticBootstrap(makeBootstrapJob(bootstrapData));

    // Bootstrap should have seeded all three concepts
    expect(createConceptStateMock).toHaveBeenCalledTimes(3);
    expect(createConceptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ masteryScore: 0.6 }),
      })
    );
  });

  it('should enqueue bootstrap with all active chapters and seed at grade-level mastery when partial abandon (< 10 answers)', async () => {
    const partialAnswers = [
      { questionId: 'q1', selectedOption: 'A' },
      { questionId: 'q2', selectedOption: 'B' },
      { questionId: 'q3', selectedOption: 'C' },
    ];
    const createConceptStateMock = jest.fn(async () => ({}));
    const enqueueMock = jest.fn(async () => {});

    const prismaMock: any = {
      question: {
        findMany: jest.fn(async () => [
          { id: 'q1', correctAnswer: 'A', choices: null, topicId: 'topic-1' },
          { id: 'q2', correctAnswer: 'A', choices: null, topicId: 'topic-1' },
          { id: 'q3', correctAnswer: 'A', choices: null, topicId: 'topic-2' },
        ]),
      },
      concept: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { id: 'c1', topicId: 'topic-1' },
            { id: 'c2', topicId: 'topic-2' },
          ])
          .mockResolvedValueOnce([
            { id: 'c1', irt_b: 0.0, bloomLevel: 'apply' },
            { id: 'c2', irt_b: 0.0, bloomLevel: 'understand' },
            { id: 'c3', irt_b: 0.0, bloomLevel: 'remember' },
          ]),
      },
      answerEvent: {
        createMany: jest.fn(async () => ({ count: 3 })),
        findMany: jest.fn(async () => [{ conceptId: 'c1', isCorrect: true }]),
      },
      chapterDef: {
        findMany: jest.fn(async () => [{ id: 'chap-1' }, { id: 'chap-2' }, { id: 'chap-3' }]),
        findUnique: jest.fn(async () => ({ subjectId: 'subj-1' })),
      },
      user: { findUnique: jest.fn(async () => ({ board: 'CBSE' })) },
      subjectDef: { findUnique: jest.fn(async () => ({ class: { id: 'class-1' } })) },
      studentConceptState: {
        findUnique: jest.fn(async () => null),
        create: createConceptStateMock,
        update: jest.fn(async () => ({})),
      },
      learningPlanItem: { count: jest.fn(async () => 0) },
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/prisma.js', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/lib/logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/lib/redis/diagnosticPartial.js', () => ({
      getPartialDiagnostic: jest.fn(async () => ({ answers: partialAnswers })),
      clearPartialDiagnostic: jest.fn(async () => {}),
    }));
    jest.doMock('@/jobs/diagnosticBootstrap.js', () => ({
      enqueueDiagnosticBootstrapJob: enqueueMock,
    }));
    jest.doMock('@/lib/diagnostics/stateStore.js', () => ({
      getSubjectDiagnosticStatus: jest.fn(async () => ({ status: 'in_progress' })),
      upsertSubjectDiagnosticStatus: jest.fn(async () => {}),
    }));
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 10 } }));
    jest.doMock('@/lib/ai/learningPlan.js', () => ({
      generateLearningPlan: jest.fn(async () => null),
    }));

    const { processDiagnosticAutoSubmit } =
      await import('@/worker/services/diagnosticAutoSubmitWorker');
    await processDiagnosticAutoSubmit(makeAutoSubmitJob());

    // Partial abandon: must query all active chapters
    expect(prismaMock.chapterDef.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lifecycle: 'active' }),
      })
    );
    // All 3 active chapters included in bootstrap
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ chapterIds: ['chap-1', 'chap-2', 'chap-3'] })
    );

    // Chain: run bootstrap with the partial-abandon payload
    const bootstrapData = enqueueMock.mock.calls[0][0];
    const { processDiagnosticBootstrap } =
      await import('@/worker/services/diagnosticBootstrapWorker');
    await processDiagnosticBootstrap(makeBootstrapJob(bootstrapData));

    // Unanswered concepts (c2, c3) must be seeded at grade-level mastery (0.5)
    const unansweredCalls = createConceptStateMock.mock.calls.filter(
      (call) => call[0]?.data?.masteryScore === 0.5 && call[0]?.data?.masteryVariance === 0.3
    );
    expect(unansweredCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should skip processing when partial state is empty (idempotent no-op)', async () => {
    const enqueueMock = jest.fn(async () => {});

    jest.doMock('@/lib/prisma', () => ({ prisma: {} }));
    jest.doMock('@/lib/prisma.js', () => ({ prisma: {} }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/lib/logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/lib/redis/diagnosticPartial.js', () => ({
      getPartialDiagnostic: jest.fn(async () => null),
      clearPartialDiagnostic: jest.fn(async () => {}),
    }));
    jest.doMock('@/jobs/diagnosticBootstrap.js', () => ({
      enqueueDiagnosticBootstrapJob: enqueueMock,
    }));
    jest.doMock('@/lib/diagnostics/stateStore.js', () => ({
      getSubjectDiagnosticStatus: jest.fn(async () => ({ status: 'in_progress' })),
      upsertSubjectDiagnosticStatus: jest.fn(async () => {}),
    }));
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 10 } }));

    const { processDiagnosticAutoSubmit } =
      await import('@/worker/services/diagnosticAutoSubmitWorker');
    await processDiagnosticAutoSubmit(makeAutoSubmitJob());

    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('should skip processing when diagnostic is already completed (idempotent guard)', async () => {
    const enqueueMock = jest.fn(async () => {});

    jest.doMock('@/lib/prisma', () => ({ prisma: {} }));
    jest.doMock('@/lib/prisma.js', () => ({ prisma: {} }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/lib/logger.js', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/lib/redis/diagnosticPartial.js', () => ({
      getPartialDiagnostic: jest.fn(async () => ({ answers: [] })),
      clearPartialDiagnostic: jest.fn(async () => {}),
    }));
    jest.doMock('@/jobs/diagnosticBootstrap.js', () => ({
      enqueueDiagnosticBootstrapJob: enqueueMock,
    }));
    jest.doMock('@/lib/diagnostics/stateStore.js', () => ({
      getSubjectDiagnosticStatus: jest.fn(async () => ({ status: 'completed' })),
      upsertSubjectDiagnosticStatus: jest.fn(async () => {}),
    }));
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 10 } }));

    const { processDiagnosticAutoSubmit } =
      await import('@/worker/services/diagnosticAutoSubmitWorker');
    await processDiagnosticAutoSubmit(makeAutoSubmitJob());

    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
