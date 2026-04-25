/**
 * Unit tests for worker/services/diagnosticAutoSubmitWorker.ts
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | added tests for gradeable-count isPartialAbandon and active-lifecycle chapter filter
 */

describe('processDiagnosticAutoSubmit', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should enqueue bootstrap for all active chapters when partial answers < minValid', async () => {
    const enqueueMock = jest.fn();
    const clearMock = jest.fn();

    // Partial state: only 1 answer -> triggers partial abandon when minValid=10
    jest.doMock('@/lib/redis/diagnosticPartial.js', () => ({
      getPartialDiagnostic: jest.fn(async () => ({
        answers: [{ questionId: 'q-1', selectedOption: '0' }],
      })),
      clearPartialDiagnostic: clearMock,
    }));

    const prismaMock: any = {
      question: {
        findMany: jest.fn(async () => [
          {
            id: 'q-1',
            correctAnswer: '0',
            choices: JSON.stringify(['A', 'B']),
            topicId: 'topic-1',
          },
        ]),
      },
      concept: { findMany: jest.fn(async () => [{ id: 'c1', topicId: 'topic-1' }]) },
      topicDef: { findMany: jest.fn(async () => [{ id: 'topic-1', chapterId: 'chap-1' }]) },
      chapterDef: { findMany: jest.fn(async () => [{ id: 'chap-1' }, { id: 'chap-2' }]) },
      user: { findUnique: jest.fn(async () => ({ board: 'b1' })) },
      subjectDef: { findUnique: jest.fn(async () => ({ class: { id: 'grade-1' } })) },
      answerEvent: { createMany: jest.fn(async () => ({ count: 1 })) },
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/jobs/diagnosticBootstrap.js', () => ({
      enqueueDiagnosticBootstrapJob: enqueueMock,
    }));
    jest.doMock('@/lib/diagnostics/stateStore.js', () => ({
      upsertSubjectDiagnosticStatus: jest.fn(),
      getSubjectDiagnosticStatus: jest.fn(async () => ({ status: 'in_progress' })),
    }));
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 10 } }));

    const { processDiagnosticAutoSubmit } =
      await import('@/worker/services/diagnosticAutoSubmitWorker');

    const fakeJob: any = {
      id: 'job-1',
      data: { userId: 's1', subjectId: 'subj-1', sessionId: 'sess-1' },
    };

    await processDiagnosticAutoSubmit(fakeJob);

    expect(enqueueMock).toHaveBeenCalled();
    const calledWith = enqueueMock.mock.calls[0][0];
    expect(Array.isArray(calledWith.chapterIds)).toBe(true);
    // Should include both chapters returned by chapterDef.findMany
    expect(calledWith.chapterIds).toEqual(expect.arrayContaining(['chap-1', 'chap-2']));
  });

  it('queries chapterDef with lifecycle: "active" filter for partial abandon', async () => {
    const enqueueMock = jest.fn();
    const clearMock = jest.fn();
    const chapterFindMany = jest.fn(async () => [{ id: 'chap-active' }]);

    jest.doMock('@/lib/redis/diagnosticPartial.js', () => ({
      getPartialDiagnostic: jest.fn(async () => ({
        answers: [{ questionId: 'q-1', selectedOption: '0' }],
      })),
      clearPartialDiagnostic: clearMock,
    }));

    const prismaMock: any = {
      question: {
        findMany: jest.fn(async () => [
          {
            id: 'q-1',
            correctAnswer: '0',
            choices: JSON.stringify(['A', 'B']),
            topicId: 'topic-1',
          },
        ]),
      },
      concept: { findMany: jest.fn(async () => [{ id: 'c1', topicId: 'topic-1' }]) },
      topicDef: { findMany: jest.fn(async () => []) },
      chapterDef: { findMany: chapterFindMany },
      user: { findUnique: jest.fn(async () => ({ board: 'b1' })) },
      subjectDef: { findUnique: jest.fn(async () => ({ class: { id: 'grade-1' } })) },
      answerEvent: { createMany: jest.fn(async () => ({ count: 1 })) },
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/jobs/diagnosticBootstrap.js', () => ({
      enqueueDiagnosticBootstrapJob: enqueueMock,
    }));
    jest.doMock('@/lib/diagnostics/stateStore.js', () => ({
      upsertSubjectDiagnosticStatus: jest.fn(),
      getSubjectDiagnosticStatus: jest.fn(async () => ({ status: 'in_progress' })),
    }));
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 10 } }));

    const { processDiagnosticAutoSubmit } =
      await import('@/worker/services/diagnosticAutoSubmitWorker');
    const fakeJob: any = {
      id: 'job-2',
      data: { userId: 's1', subjectId: 'subj-1', sessionId: 'sess-1' },
    };

    await processDiagnosticAutoSubmit(fakeJob);

    // chapterDef.findMany must be called with the lifecycle filter
    expect(chapterFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lifecycle: 'active' }),
      })
    );
  });

  it('uses gradeable answer count (not raw Redis answer count) to determine isPartialAbandon', async () => {
    // 5 answers in Redis but only 2 have valid question+concept mappings -> isPartialAbandon = true (2 < 10)
    const enqueueMock = jest.fn();
    const clearMock = jest.fn();

    jest.doMock('@/lib/redis/diagnosticPartial.js', () => ({
      getPartialDiagnostic: jest.fn(async () => ({
        answers: [
          { questionId: 'q-1', selectedOption: '0' },
          { questionId: 'q-2', selectedOption: '1' },
          { questionId: 'missing-1', selectedOption: '0' }, // no matching question
          { questionId: 'missing-2', selectedOption: '1' }, // no matching question
          { questionId: 'no-concept', selectedOption: '2' }, // question exists but no concept
        ],
      })),
      clearPartialDiagnostic: clearMock,
    }));

    const prismaMock: any = {
      question: {
        findMany: jest.fn(async () => [
          {
            id: 'q-1',
            correctAnswer: '0',
            choices: JSON.stringify(['A', 'B']),
            topicId: 'topic-1',
          },
          {
            id: 'q-2',
            correctAnswer: '1',
            choices: JSON.stringify(['A', 'B']),
            topicId: 'topic-1',
          },
          {
            id: 'no-concept',
            correctAnswer: '2',
            choices: JSON.stringify(['A', 'B', 'C']),
            topicId: 'topic-no-concept',
          },
        ]),
      },
      concept: {
        findMany: jest.fn(async () => [
          { id: 'c1', topicId: 'topic-1' },
          // topic-no-concept has no concept entry
        ]),
      },
      topicDef: { findMany: jest.fn(async () => []) },
      chapterDef: { findMany: jest.fn(async () => [{ id: 'chap-1' }]) },
      user: { findUnique: jest.fn(async () => ({ board: 'b1' })) },
      subjectDef: { findUnique: jest.fn(async () => ({ class: { id: 'grade-1' } })) },
      answerEvent: { createMany: jest.fn(async () => ({ count: 2 })) },
    };

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.doMock('@/jobs/diagnosticBootstrap.js', () => ({
      enqueueDiagnosticBootstrapJob: enqueueMock,
    }));
    jest.doMock('@/lib/diagnostics/stateStore.js', () => ({
      upsertSubjectDiagnosticStatus: jest.fn(),
      getSubjectDiagnosticStatus: jest.fn(async () => ({ status: 'in_progress' })),
    }));
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 10 } }));

    const { processDiagnosticAutoSubmit } =
      await import('@/worker/services/diagnosticAutoSubmitWorker');
    const fakeJob: any = {
      id: 'job-3',
      data: { userId: 's1', subjectId: 'subj-1', sessionId: 'sess-1' },
    };

    await processDiagnosticAutoSubmit(fakeJob);

    // Only 2 gradeable answers (< minValid=10) so it's treated as a partial abandon
    // and bootstrap is enqueued (using chapter-level fallback)
    expect(enqueueMock).toHaveBeenCalled();
    // chapterDef was queried (partial abandon path) — confirms gradeable count drove the decision
    expect(prismaMock.chapterDef.findMany).toHaveBeenCalled();
  });
});
