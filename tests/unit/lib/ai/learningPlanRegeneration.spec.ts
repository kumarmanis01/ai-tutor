/**
 * FILE OBJECTIVE:
 * - Unit tests for guarded learning-plan regeneration dedup lock behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/learningPlanRegeneration.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - /.github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-04T00:00:00Z | copilot | add dedup lock tests for enqueueLearningPlanRegeneration
 */

describe('enqueueLearningPlanRegeneration', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('deduplicates concurrent requests when no redis client is available', async () => {
    let resolveGeneration: (() => void) | null = null
    const generationPromise = new Promise<string | null>((resolve) => {
      resolveGeneration = () => resolve('plan-1')
    })

    const generateMock = jest.fn(() => generationPromise)

    jest.doMock('@/lib/ai/learningPlan', () => ({ generateLearningPlan: generateMock }))
    jest.doMock('@/lib/redis', () => ({ getRedis: jest.fn(() => null) }))
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }))

    const { enqueueLearningPlanRegeneration, __testOnly } = await import('@/lib/ai/learningPlanRegeneration')

    __testOnly.clearLocalLocks()

    const first = await enqueueLearningPlanRegeneration({
      studentId: 'u1',
      subjectId: 'math',
      weeklyGoal: 5,
      routeName: 'TestRoute',
      methodName: 'POST',
    })

    const second = await enqueueLearningPlanRegeneration({
      studentId: 'u1',
      subjectId: 'math',
      weeklyGoal: 5,
      routeName: 'TestRoute',
      methodName: 'POST',
    })

    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(generateMock).toHaveBeenCalledTimes(1)

    resolveGeneration?.()
    await generationPromise
    await Promise.resolve()

    const third = await enqueueLearningPlanRegeneration({
      studentId: 'u1',
      subjectId: 'math',
      weeklyGoal: 5,
      routeName: 'TestRoute',
      methodName: 'POST',
    })

    expect(third).toBe(true)
    expect(generateMock).toHaveBeenCalledTimes(2)
  })

  it('skips when redis NX lock is already held', async () => {
    const generateMock = jest.fn(async () => 'plan-1')
    const redisSetMock = jest.fn(async () => null)
    const redisMock = {
      set: redisSetMock,
      get: jest.fn(async () => null),
      del: jest.fn(async () => 1),
    }

    jest.doMock('@/lib/ai/learningPlan', () => ({ generateLearningPlan: generateMock }))
    jest.doMock('@/lib/redis', () => ({ getRedis: jest.fn(() => redisMock) }))
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }))

    const { enqueueLearningPlanRegeneration, __testOnly } = await import('@/lib/ai/learningPlanRegeneration')

    __testOnly.clearLocalLocks()

    const started = await enqueueLearningPlanRegeneration({
      studentId: 'u2',
      subjectId: 'science',
      weeklyGoal: 6,
      routeName: 'TestRoute',
      methodName: 'GET',
    })

    expect(started).toBe(false)
    expect(generateMock).not.toHaveBeenCalled()
    expect(redisSetMock).toHaveBeenCalled()
  })
})
