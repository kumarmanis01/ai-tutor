/**
 * Unit tests for worker/services/diagnosticAutoSubmitWorker.ts
 */

describe('processDiagnosticAutoSubmit', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('should enqueue bootstrap for all chapters when partial answers < minValid', async () => {
    const enqueueMock = jest.fn()
    const clearMock = jest.fn()

    // Partial state: only 1 answer -> triggers partial abandon when minValid=10
    jest.doMock('@/lib/redis/diagnosticPartial.js', () => ({
      getPartialDiagnostic: jest.fn(async () => ({ answers: [{ questionId: 'q-1', selectedOption: '0' }] })),
      clearPartialDiagnostic: clearMock,
    }))

    const prismaMock: any = {
      question: { findMany: jest.fn(async () => [{ id: 'q-1', correctAnswer: '0', choices: JSON.stringify(['A','B']), topicId: 'topic-1' }]) },
      concept: { findMany: jest.fn(async () => [{ id: 'c1', topicId: 'topic-1' }]) },
      topicDef: { findMany: jest.fn(async () => [{ id: 'topic-1', chapterId: 'chap-1' }]) },
      chapterDef: { findMany: jest.fn(async () => [{ id: 'chap-1' }, { id: 'chap-2' }]) },
      user: { findUnique: jest.fn(async () => ({ board: 'b1' })) },
      subjectDef: { findUnique: jest.fn(async () => ({ class: { id: 'grade-1' } })) },
      answerEvent: { createMany: jest.fn(async () => ({ count: 1 })) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/jobs/diagnosticBootstrap.js', () => ({ enqueueDiagnosticBootstrapJob: enqueueMock }))
    jest.doMock('@/lib/diagnostics/stateStore.js', () => ({ upsertSubjectDiagnosticStatus: jest.fn() }))
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 10 } }))

    const { processDiagnosticAutoSubmit } = await import('@/worker/services/diagnosticAutoSubmitWorker')

    const fakeJob: any = { id: 'job-1', data: { userId: 's1', subjectId: 'subj-1', sessionId: 'sess-1' } }

    await processDiagnosticAutoSubmit(fakeJob)

    expect(enqueueMock).toHaveBeenCalled()
    const calledWith = enqueueMock.mock.calls[0][0]
    expect(Array.isArray(calledWith.chapterIds)).toBe(true)
    // Should include both chapters returned by chapterDef.findMany
    expect(calledWith.chapterIds).toEqual(expect.arrayContaining(['chap-1', 'chap-2']))
  })
})
