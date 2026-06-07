/**
 * Unit tests for processDiagnosticBootstrap.
 *
 * Covers: happy path, partial-abandon mastery, idempotency (skip when higher
 * mastery exists), and early-return on invalid job data.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeJob(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'job-1',
    data: {
      studentId: 's1',
      diagnosticSessionId: 'diag-1',
      chapterIds: ['chap-1'],
      boardId: 'b1',
      gradeId: 'g1',
      ...overrides,
    },
  }
}

describe('processDiagnosticBootstrap', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('should return early without seeding when job data is invalid (missing studentId)', async () => {
    const warnMock = jest.fn()

    jest.doMock('@/lib/prisma', () => ({ prisma: {} }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: warnMock, error: jest.fn() } }))
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 10 } }))
    jest.doMock('@/lib/ai/learningPlan.js', () => ({ generateLearningPlan: jest.fn() }))
    jest.doMock('@/lib/notifications/parentNotify.js', () => ({ notifyParent: jest.fn().mockResolvedValue(undefined), DEFAULT_DASHBOARD_URL: 'https://spinzyacademy.com/parent/dashboard' }))
    jest.doMock('@/lib/constants/mail.js', () => ({ PARENT_NOTIF_EVENTS: { DIAGNOSTIC_COMPLETE: 'diagnostic_complete', PLAN_GENERATED: 'plan_generated' } }))

    const { processDiagnosticBootstrap } = await import('@/worker/services/diagnosticBootstrapWorker')

    await processDiagnosticBootstrap(makeJob({ studentId: '' }))

    expect(warnMock).toHaveBeenCalledWith(
      '[diagnostic-bootstrap] invalid job data',
      expect.objectContaining({ jobId: 'job-1' }),
    )
  })

  it('should seed concept states with correct initial mastery when all answers provided', async () => {
    const createMock = jest.fn(async () => ({}))
    const updateMock = jest.fn(async () => ({}))

    const prismaMock: any = {
      concept: {
        findMany: jest.fn(async () => [
          { id: 'c1', irt_b: 0.5, bloomLevel: 'apply' },
          { id: 'c2', irt_b: -0.5, bloomLevel: 'remember' },
          { id: 'c3', irt_b: 0.0, bloomLevel: 'understand' },
        ]),
      },
      answerEvent: {
        findMany: jest.fn(async () => [
          { conceptId: 'c1', isCorrect: true },   // correct -> 0.6
          { conceptId: 'c2', isCorrect: false },   // wrong   -> 0.15
          // c3 unanswered -> 0.3
        ]),
      },
      studentConceptState: {
        findUnique: jest.fn(async () => null), // no existing state -- always create
        create: createMock,
        update: updateMock,
      },
      chapterDef: { findUnique: jest.fn(async () => null) },
      learningPlanItem: { count: jest.fn(async () => 0) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    // Supply more answers than minValid so we are NOT in partial-abandon mode
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 1 } }))
    jest.doMock('@/lib/ai/learningPlan.js', () => ({ generateLearningPlan: jest.fn().mockResolvedValue(null) }))
    jest.doMock('@/lib/notifications/parentNotify.js', () => ({ notifyParent: jest.fn().mockResolvedValue(undefined), DEFAULT_DASHBOARD_URL: 'https://spinzyacademy.com/parent/dashboard' }))
    jest.doMock('@/lib/constants/mail.js', () => ({ PARENT_NOTIF_EVENTS: { DIAGNOSTIC_COMPLETE: 'diagnostic_complete', PLAN_GENERATED: 'plan_generated' } }))

    const { processDiagnosticBootstrap } = await import('@/worker/services/diagnosticBootstrapWorker')

    await processDiagnosticBootstrap(makeJob())

    // Correct answer -> masteryScore 0.6
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conceptId: 'c1', masteryScore: 0.6 }) }),
    )
    // Wrong answer -> masteryScore 0.15
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conceptId: 'c2', masteryScore: 0.15 }) }),
    )
    // Unanswered (not partial abandon) -> masteryScore 0.3
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conceptId: 'c3', masteryScore: 0.3 }) }),
    )
    // No updates when no prior state exists
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('should use masteryScore 0.5 for unanswered concepts when partial abandon detected', async () => {
    const createMock = jest.fn(async () => ({}))

    const prismaMock: any = {
      concept: {
        findMany: jest.fn(async () => [
          { id: 'cA', irt_b: 0.0, bloomLevel: 'apply' },
          { id: 'cB', irt_b: 0.0, bloomLevel: 'apply' },
        ]),
      },
      answerEvent: {
        // Only 1 answer provided; minValid = 10 -> partial abandon
        findMany: jest.fn(async () => [{ conceptId: 'cA', isCorrect: true }]),
      },
      studentConceptState: {
        findUnique: jest.fn(async () => null),
        create: createMock,
        update: jest.fn(async () => ({})),
      },
      chapterDef: { findUnique: jest.fn(async () => null) },
      learningPlanItem: { count: jest.fn(async () => 0) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 10 } }))
    jest.doMock('@/lib/ai/learningPlan.js', () => ({ generateLearningPlan: jest.fn().mockResolvedValue(null) }))
    jest.doMock('@/lib/notifications/parentNotify.js', () => ({ notifyParent: jest.fn().mockResolvedValue(undefined), DEFAULT_DASHBOARD_URL: 'https://spinzyacademy.com/parent/dashboard' }))
    jest.doMock('@/lib/constants/mail.js', () => ({ PARENT_NOTIF_EVENTS: { DIAGNOSTIC_COMPLETE: 'diagnostic_complete', PLAN_GENERATED: 'plan_generated' } }))

    const { processDiagnosticBootstrap } = await import('@/worker/services/diagnosticBootstrapWorker')

    await processDiagnosticBootstrap(makeJob())

    // cA was answered correctly -> 0.6 regardless of partial abandon
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conceptId: 'cA', masteryScore: 0.6 }) }),
    )
    // cB was unanswered under partial abandon -> 0.5
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conceptId: 'cB', masteryScore: 0.5 }) }),
    )
  })

  it('should skip update when existing mastery is already higher (idempotency)', async () => {
    const updateMock = jest.fn(async () => ({}))
    const createMock = jest.fn(async () => ({}))

    const prismaMock: any = {
      concept: {
        findMany: jest.fn(async () => [{ id: 'c1', irt_b: 0.0, bloomLevel: 'apply' }]),
      },
      answerEvent: {
        findMany: jest.fn(async () => [{ conceptId: 'c1', isCorrect: true }]), // would compute 0.6
      },
      studentConceptState: {
        // Existing state has 0.9 -- already higher than 0.6
        findUnique: jest.fn(async () => ({ masteryScore: 0.9, attemptCount: 5 })),
        create: createMock,
        update: updateMock,
      },
      chapterDef: { findUnique: jest.fn(async () => null) },
      learningPlanItem: { count: jest.fn(async () => 0) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 1 } }))
    jest.doMock('@/lib/ai/learningPlan.js', () => ({ generateLearningPlan: jest.fn().mockResolvedValue(null) }))
    jest.doMock('@/lib/notifications/parentNotify.js', () => ({ notifyParent: jest.fn().mockResolvedValue(undefined), DEFAULT_DASHBOARD_URL: 'https://spinzyacademy.com/parent/dashboard' }))
    jest.doMock('@/lib/constants/mail.js', () => ({ PARENT_NOTIF_EVENTS: { DIAGNOSTIC_COMPLETE: 'diagnostic_complete', PLAN_GENERATED: 'plan_generated' } }))

    const { processDiagnosticBootstrap } = await import('@/worker/services/diagnosticBootstrapWorker')

    await processDiagnosticBootstrap(makeJob())

    expect(createMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('proactive bootstrap (bootstrap: sessionId, 0 answers) is NOT a partial abandon -- uses 0.3 baseline', async () => {
    const createMock = jest.fn(async () => ({}))
    const partialAbandonInfo = jest.fn()

    const prismaMock: any = {
      user: { findUnique: jest.fn(async () => ({ accountStatus: 'pending_parent_verification' })) },
      concept: {
        findMany: jest.fn(async () => [{ id: 'c1', irt_b: 0, bloomLevel: 'apply' }]),
      },
      answerEvent: { findMany: jest.fn(async () => []) },
      studentConceptState: {
        findUnique: jest.fn(async () => null),
        create: createMock,
        update: jest.fn(async () => ({})),
      },
      chapterDef: { findUnique: jest.fn(async () => null) },
      learningPlanItem: { count: jest.fn(async () => 0) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({
      logger: {
        info: (msg: string, ctx?: unknown) => {
          if (typeof msg === 'string' && msg.includes('partial_abandon_detected')) partialAbandonInfo(ctx)
        },
        warn: jest.fn(),
        error: jest.fn(),
      },
    }))
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 10 } }))
    jest.doMock('@/lib/ai/learningPlan.js', () => ({ generateLearningPlan: jest.fn().mockResolvedValue(null) }))
    jest.doMock('@/lib/notifications/parentNotify.js', () => ({ notifyParent: jest.fn().mockResolvedValue(undefined), DEFAULT_DASHBOARD_URL: 'https://spinzyacademy.com/parent/dashboard' }))
    jest.doMock('@/lib/constants/mail.js', () => ({ PARENT_NOTIF_EVENTS: { DIAGNOSTIC_COMPLETE: 'diagnostic_complete', PLAN_GENERATED: 'plan_generated' } }))

    const { processDiagnosticBootstrap } = await import('@/worker/services/diagnosticBootstrapWorker')

    await processDiagnosticBootstrap(makeJob({ diagnosticSessionId: 'bootstrap:s1' }))

    // 0.3 (no-answer baseline), NOT 0.5 (partial-abandon bonus).
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conceptId: 'c1', masteryScore: 0.3 }) }),
    )
    expect(partialAbandonInfo).not.toHaveBeenCalled()
  })

  it('skips parent notifications and plan generation when accountStatus !== active', async () => {
    const notifyParentMock = jest.fn().mockResolvedValue(undefined)
    const generateLearningPlanMock = jest.fn().mockResolvedValue('plan-x')

    const prismaMock: any = {
      user: { findUnique: jest.fn(async () => ({ accountStatus: 'pending_parent_verification' })) },
      concept: {
        findMany: jest.fn(async () => [{ id: 'c1', irt_b: 0, bloomLevel: 'apply' }]),
      },
      answerEvent: {
        findMany: jest.fn(async () => [
          { conceptId: 'c1', isCorrect: true },
          { conceptId: 'c1', isCorrect: true },
        ]),
      },
      studentConceptState: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => ({})),
        update: jest.fn(async () => ({})),
      },
      chapterDef: { findUnique: jest.fn(async () => ({ subjectId: 'subj-1', subject: { name: 'Math' } })) },
      subjectDef: { findUnique: jest.fn(async () => ({ name: 'Math' })) },
      learningPlanItem: { count: jest.fn(async () => 0) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 1 } }))
    jest.doMock('@/lib/ai/learningPlan.js', () => ({ generateLearningPlan: generateLearningPlanMock }))
    jest.doMock('@/lib/notifications/parentNotify.js', () => ({ notifyParent: notifyParentMock, DEFAULT_DASHBOARD_URL: 'https://spinzyacademy.com/parent/dashboard' }))
    jest.doMock('@/lib/constants/mail.js', () => ({ PARENT_NOTIF_EVENTS: { DIAGNOSTIC_COMPLETE: 'diagnostic_complete', PLAN_GENERATED: 'plan_generated' } }))

    const { processDiagnosticBootstrap } = await import('@/worker/services/diagnosticBootstrapWorker')

    await processDiagnosticBootstrap(makeJob())

    expect(notifyParentMock).not.toHaveBeenCalled()
    expect(generateLearningPlanMock).not.toHaveBeenCalled()
  })

  it('runs parent notifications and plan generation when accountStatus === active', async () => {
    const notifyParentMock = jest.fn().mockResolvedValue(undefined)
    const generateLearningPlanMock = jest.fn().mockResolvedValue('plan-active')

    const prismaMock: any = {
      user: { findUnique: jest.fn(async () => ({ accountStatus: 'active' })) },
      concept: {
        findMany: jest.fn(async () => [{ id: 'c1', irt_b: 0, bloomLevel: 'apply' }]),
      },
      answerEvent: {
        findMany: jest.fn(async () => [
          { conceptId: 'c1', isCorrect: true },
          { conceptId: 'c1', isCorrect: true },
        ]),
      },
      studentConceptState: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => ({})),
        update: jest.fn(async () => ({})),
      },
      chapterDef: { findUnique: jest.fn(async () => ({ subjectId: 'subj-1', subject: { name: 'Math' } })) },
      subjectDef: { findUnique: jest.fn(async () => ({ name: 'Math' })) },
      learningPlanItem: { count: jest.fn(async () => 5) },
    }

    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/config', () => ({ diagnosticConfig: { minAnswersForValidity: 1 } }))
    jest.doMock('@/lib/ai/learningPlan.js', () => ({ generateLearningPlan: generateLearningPlanMock }))
    jest.doMock('@/lib/notifications/parentNotify.js', () => ({ notifyParent: notifyParentMock, DEFAULT_DASHBOARD_URL: 'https://spinzyacademy.com/parent/dashboard' }))
    jest.doMock('@/lib/constants/mail.js', () => ({ PARENT_NOTIF_EVENTS: { DIAGNOSTIC_COMPLETE: 'diagnostic_complete', PLAN_GENERATED: 'plan_generated' } }))

    const { processDiagnosticBootstrap } = await import('@/worker/services/diagnosticBootstrapWorker')

    await processDiagnosticBootstrap(makeJob())

    expect(notifyParentMock).toHaveBeenCalledWith('s1', expect.objectContaining({ event: 'diagnostic_complete' }))
    expect(generateLearningPlanMock).toHaveBeenCalledWith('s1', 'subj-1')
    expect(notifyParentMock).toHaveBeenCalledWith('s1', expect.objectContaining({ event: 'plan_generated' }))
  })
})
