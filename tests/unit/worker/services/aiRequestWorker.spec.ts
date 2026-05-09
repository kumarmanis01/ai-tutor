/**
 * FILE OBJECTIVE:
 * - Validate AI request worker doubt flow uses explicit prompt and persists parsed AI_DOUBT responses.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/aiRequestWorker.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | add AI_DOUBT worker coverage for explicit prompt and persistence path
 * - 2026-05-08T00:00:00Z | copilot | update AI_DOUBT worker fixture to use follow-up question arrays
 */

/**
 * FILE OBJECTIVE:
 * - Validate AI request worker: AI_DOUBT explicit prompt + persistence path,
 *   and NARRATIVE Redis cache-write path.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/aiRequestWorker.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | add AI_DOUBT worker coverage for explicit prompt and persistence path
 * - 2026-05-08T00:00:00Z | copilot | update AI_DOUBT worker fixture to use follow-up question arrays
 * - 2026-05-09T00:00:00Z | copilot | add NARRATIVE cache-write coverage (Gap 1 fix)
 */

describe('processAIRequest AI_DOUBT', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('uses payload.prompt and persists parsed doubt response', async () => {
    const callLLMMock = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        response: 'A real number can be rational or irrational.',
        followUpQuestions: ['Can you give one rational number?'],
        confidenceLevel: 'high',
      }),
      usage: { prompt_tokens: 10, completion_tokens: 12 },
      latencyMs: 100,
    })

    const studentQuestionUpdateMock = jest.fn().mockResolvedValue({})
    const questionAnswerCreateMock = jest.fn().mockResolvedValue({})

    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }))
    jest.doMock('@/lib/ai/guardrails', () => ({
      classifyIntent: jest.fn(() => ({ primaryIntent: 'conceptual_clarity', requiresIntervention: false })),
      getSafeResponseForIntent: jest.fn(),
      formatResponseForStudent: jest.fn(),
      checkForHallucinations: jest.fn(() => ({ shouldBlock: false })),
    }))
    jest.doMock('@/lib/callLLM', () => ({ callLLM: callLLMMock }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        chat: { create: jest.fn() },
        aIContentLog: { create: jest.fn().mockResolvedValue({}) },
        studentQuestion: { update: studentQuestionUpdateMock },
        questionAnswer: { create: questionAnswerCreateMock },
      },
    }))

    const { processAIRequest } = await import('@/worker/services/aiRequestWorker')

    const result = await processAIRequest({
      id: 'job-1',
      data: {
        type: 'AI_DOUBT',
        payload: {
          prompt: 'EXPLICIT_DOUBTS_PROMPT',
          messages: [{ role: 'user', content: 'ignored when explicit prompt exists' }],
          meta: { questionId: 'q-1', studentId: 's-1', grade: 8, subject: 'Math', language: 'en' },
        },
      },
    } as any)

    expect(callLLMMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'EXPLICIT_DOUBTS_PROMPT',
      }),
    )
    expect(studentQuestionUpdateMock).toHaveBeenCalled()
    expect(questionAnswerCreateMock).toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        status: 'completed',
        questionId: 'q-1',
      }),
    )
  })
})

// ── NARRATIVE cache-write ─────────────────────────────────────────────────────

describe('processAIRequest NARRATIVE', () => {
  const NARRATIVE_TEXT = 'You improved 18% in Algebra this month!'
  const mockRedisSet = jest.fn().mockResolvedValue('OK')
  const mockRedisInstance = { set: mockRedisSet }

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  function buildNarrativeMocks(redisInstance: any) {
    jest.doMock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }))
    jest.doMock('@/lib/ai/guardrails', () => ({
      classifyIntent: jest.fn(() => ({ primaryIntent: 'conceptual_clarity', requiresIntervention: false })),
      getSafeResponseForIntent: jest.fn(),
      formatResponseForStudent: jest.fn(),
      checkForHallucinations: jest.fn(() => ({ shouldBlock: false })),
    }))
    jest.doMock('@/lib/callLLM', () => ({
      callLLM: jest.fn().mockResolvedValue({ content: NARRATIVE_TEXT, usage: {}, latencyMs: 50 }),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        chat: { create: jest.fn() },
        aIContentLog: { create: jest.fn().mockResolvedValue({}) },
      },
    }))
    jest.doMock('@/lib/redis', () => ({
      getRedis: jest.fn(() => redisInstance),
    }))
  }

  it('writes the LLM result to Redis under payload.cacheKey with the given TTL', async () => {
    buildNarrativeMocks(mockRedisInstance)
    const { processAIRequest } = await import('@/worker/services/aiRequestWorker')

    const result = await processAIRequest({
      id: 'job-narrative-1',
      data: {
        type: 'NARRATIVE',
        payload: {
          userId: 'user-1',
          sessionCount: 5,
          subjectNames: ['Mathematics'],
          bestChapterName: 'Algebra',
          weakestChapterName: 'Geometry',
          timeframeDays: 30,
          model: 'gpt-4o-mini',
          cacheKey: 'narrative:user-1',
          cacheTtlSeconds: 21600,
        },
      },
    } as any)

    expect(mockRedisSet).toHaveBeenCalledWith(
      'narrative:user-1',
      NARRATIVE_TEXT,
      'EX',
      21600,
    )
    expect(result).toEqual({ status: 'completed', type: 'NARRATIVE' })
  })

  it('uses a default 6 h TTL when cacheTtlSeconds is not provided', async () => {
    buildNarrativeMocks(mockRedisInstance)
    const { processAIRequest } = await import('@/worker/services/aiRequestWorker')

    await processAIRequest({
      id: 'job-narrative-2',
      data: {
        type: 'NARRATIVE',
        payload: {
          userId: 'user-1',
          sessionCount: 0,
          subjectNames: [],
          bestChapterName: 'your strongest topic',
          weakestChapterName: 'your area to focus on',
          timeframeDays: 30,
          model: 'gpt-4o-mini',
          cacheKey: 'narrative:user-1',
          // cacheTtlSeconds intentionally omitted
        },
      },
    } as any)

    expect(mockRedisSet).toHaveBeenCalledWith(
      'narrative:user-1',
      NARRATIVE_TEXT,
      'EX',
      6 * 60 * 60,
    )
  })

  it('completes without throwing when Redis is unavailable (getRedis returns null)', async () => {
    buildNarrativeMocks(null) // null = no Redis
    const { processAIRequest } = await import('@/worker/services/aiRequestWorker')

    const result = await processAIRequest({
      id: 'job-narrative-3',
      data: {
        type: 'NARRATIVE',
        payload: {
          userId: 'user-1',
          sessionCount: 2,
          subjectNames: ['Science'],
          bestChapterName: 'Motion',
          weakestChapterName: 'Optics',
          timeframeDays: 30,
          model: 'gpt-4o-mini',
          cacheKey: 'narrative:user-1',
          cacheTtlSeconds: 21600,
        },
      },
    } as any)

    expect(mockRedisSet).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'completed', type: 'NARRATIVE' })
  })

  it('completes without throwing when Redis.set throws', async () => {
    const failingRedis = { set: jest.fn().mockRejectedValue(new Error('ECONNRESET')) }
    buildNarrativeMocks(failingRedis)
    const { processAIRequest } = await import('@/worker/services/aiRequestWorker')

    await expect(
      processAIRequest({
        id: 'job-narrative-4',
        data: {
          type: 'NARRATIVE',
          payload: {
            userId: 'user-1',
            sessionCount: 3,
            subjectNames: ['Mathematics'],
            bestChapterName: 'Algebra',
            weakestChapterName: 'Statistics',
            timeframeDays: 30,
            model: 'gpt-4o-mini',
            cacheKey: 'narrative:user-1',
            cacheTtlSeconds: 21600,
          },
        },
      } as any),
    ).resolves.toEqual({ status: 'completed', type: 'NARRATIVE' })
  })
})
