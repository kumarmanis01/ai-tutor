/**
 * FILE OBJECTIVE:
 * - Validate doubts API quota-aware direct LLM flow, retry safety, and fallback refund behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/doubts/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | add coverage for fast-answer and queued-response doubts API paths
 * - 2026-05-08T00:00:00Z | copilot | replace queued path tests with direct synchronous LLM and fallback coverage
 * - 2026-05-08T00:00:00Z | copilot | add quota success, limit reached, retry-safe, and refund-on-failure test coverage
 */

describe('doubts route direct LLM flow', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns immediate answer on successful quota consume and direct LLM response', async () => {
    const findUniqueMock = jest
      .fn()
      .mockResolvedValueOnce({ grade: '8', board: 'CBSE', language: 'en' })

    const updateMock = jest.fn().mockResolvedValue({})
    const answerCreateMock = jest.fn().mockResolvedValue({})
    const generateDoubtResponseMock = jest.fn().mockResolvedValue({
      success: true,
      data: {
        response: 'Real numbers include rational and irrational numbers.',
        followUpQuestion: 'Can you name one irrational number?',
        confidenceLevel: 'high',
      },
      error: null,
      validationErrors: [],
      metadata: {
        requestId: 'req-1',
        promptType: 'doubts',
        timestamp: new Date().toISOString(),
        userIdHash: 'student-1',
        sessionId: 'q-1',
      },
    })
    const consumeDailyFreeQuestionQuotaMock = jest.fn().mockResolvedValue({
      status: 'ok',
      isPremium: false,
      charged: true,
      remaining: 4,
      method: 'column',
    })
    const refundDailyFreeQuestionQuotaMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({ user: { id: 'student-1', grade: '8' } }),
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/ai/prompts/promptBuilder', () => ({
      generateDoubtResponse: generateDoubtResponseMock,
    }))
    jest.doMock('@/lib/ai/prompts/doubts', () => ({
      isOffTopicQuestion: jest.fn(() => false),
      getOffTopicRedirect: jest.fn(),
    }))
    jest.doMock('@/lib/freeQuestionQuota', () => ({
      consumeDailyFreeQuestionQuota: consumeDailyFreeQuestionQuotaMock,
      refundDailyFreeQuestionQuota: refundDailyFreeQuestionQuotaMock,
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: findUniqueMock },
        studentQuestion: {
          findFirst: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'q-1', aiMetadata: null }),
          update: updateMock,
          findMany: jest.fn(),
        },
        questionAnswer: { create: answerCreateMock },
      },
    }))

    const { POST } = await import('@/app/api/doubts/route')
    const req = new Request('http://localhost/api/doubts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'What are real numbers?', subject: 'Math' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questionId).toBe('q-1')
    expect(body.response).toContain('Real numbers')
    expect(body.confidenceLevel).toBe('high')
    expect(generateDoubtResponseMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(answerCreateMock).toHaveBeenCalledTimes(1)
    expect(consumeDailyFreeQuestionQuotaMock).toHaveBeenCalledWith('student-1')
    expect(refundDailyFreeQuestionQuotaMock).not.toHaveBeenCalled()
    expect(body.status).toBeUndefined()
  })

  it('returns 403 when quota is exhausted before doubt generation', async () => {
    const generateDoubtResponseMock = jest.fn()
    const consumeDailyFreeQuestionQuotaMock = jest.fn().mockResolvedValue({ status: 'limit_reached' })

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({ user: { id: 'student-2', grade: '8' } }),
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/ai/prompts/promptBuilder', () => ({
      generateDoubtResponse: generateDoubtResponseMock,
    }))
    jest.doMock('@/lib/ai/prompts/doubts', () => ({
      isOffTopicQuestion: jest.fn(() => false),
      getOffTopicRedirect: jest.fn(),
    }))
    jest.doMock('@/lib/freeQuestionQuota', () => ({
      consumeDailyFreeQuestionQuota: consumeDailyFreeQuestionQuotaMock,
      refundDailyFreeQuestionQuota: jest.fn(),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: jest.fn() },
        studentQuestion: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
        },
        questionAnswer: { create: jest.fn() },
      },
    }))

    const { POST } = await import('@/app/api/doubts/route')
    const req = new Request('http://localhost/api/doubts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'Explain vectors', subject: 'Math' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('free_limit_reached')
    expect(generateDoubtResponseMock).not.toHaveBeenCalled()
  })

  it('returns cached answered response on retry and does not consume quota again', async () => {
    const findUniqueMock = jest
      .fn()
      .mockResolvedValueOnce({ grade: '8', board: 'CBSE', language: 'en' })
    const consumeDailyFreeQuestionQuotaMock = jest.fn()
    const generateDoubtResponseMock = jest.fn()

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({ user: { id: 'student-3', grade: '8' } }),
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/ai/prompts/promptBuilder', () => ({
      generateDoubtResponse: generateDoubtResponseMock,
    }))
    jest.doMock('@/lib/ai/prompts/doubts', () => ({
      isOffTopicQuestion: jest.fn(() => false),
      getOffTopicRedirect: jest.fn(),
    }))
    jest.doMock('@/lib/freeQuestionQuota', () => ({
      consumeDailyFreeQuestionQuota: consumeDailyFreeQuestionQuotaMock,
      refundDailyFreeQuestionQuota: jest.fn(),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: findUniqueMock },
        studentQuestion: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'q-3',
            studentId: 'student-3',
            status: 'answered',
            content: 'What is photosynthesis?',
            answerSummary: 'Photosynthesis is the process plants use to make food.',
            aiMetadata: {
              followUpQuestion: 'Can you list the inputs of photosynthesis?',
              confidenceLevel: 'high',
            },
          }),
          create: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
        },
        questionAnswer: { create: jest.fn() },
      },
    }))

    const { POST } = await import('@/app/api/doubts/route')
    const req = new Request('http://localhost/api/doubts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionId: 'q-3',
        question: 'What is photosynthesis?',
        subject: 'Science',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.retried).toBe(true)
    expect(body.questionId).toBe('q-3')
    expect(body.response).toContain('Photosynthesis')
    expect(consumeDailyFreeQuestionQuotaMock).not.toHaveBeenCalled()
    expect(generateDoubtResponseMock).not.toHaveBeenCalled()
  })

  it('refunds consumed quota when direct LLM generation fails', async () => {
    const findUniqueMock = jest
      .fn()
      .mockResolvedValueOnce({ grade: '8', board: 'CBSE', language: 'en' })

    const updateMock = jest.fn().mockResolvedValue({})
    const answerCreateMock = jest.fn().mockResolvedValue({})
    const generateDoubtResponseMock = jest.fn().mockResolvedValue({
      success: false,
      data: null,
      error: 'timeout',
      validationErrors: [],
      metadata: {
        requestId: 'req-2',
        promptType: 'doubts',
        timestamp: new Date().toISOString(),
        userIdHash: 'student-2',
        sessionId: 'q-2',
      },
    })
    const consumeDailyFreeQuestionQuotaMock = jest.fn().mockResolvedValue({
      status: 'ok',
      isPremium: false,
      charged: true,
      remaining: 2,
      method: 'column',
    })
    const refundDailyFreeQuestionQuotaMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({ user: { id: 'student-2', grade: '8' } }),
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/ai/prompts/promptBuilder', () => ({
      generateDoubtResponse: generateDoubtResponseMock,
    }))
    jest.doMock('@/lib/ai/prompts/doubts', () => ({
      isOffTopicQuestion: jest.fn(() => false),
      getOffTopicRedirect: jest.fn(),
    }))
    jest.doMock('@/lib/freeQuestionQuota', () => ({
      consumeDailyFreeQuestionQuota: consumeDailyFreeQuestionQuotaMock,
      refundDailyFreeQuestionQuota: refundDailyFreeQuestionQuotaMock,
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: findUniqueMock },
        studentQuestion: {
          findFirst: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'q-2', aiMetadata: null }),
          update: updateMock,
          findMany: jest.fn(),
        },
        questionAnswer: { create: answerCreateMock },
      },
    }))

    const { POST } = await import('@/app/api/doubts/route')
    const req = new Request('http://localhost/api/doubts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'Explain quadratic equations', subject: 'Math' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fallback).toBe(true)
    expect(body.response).toContain('I am having a little trouble connecting right now')
    expect(body.status).toBeUndefined()
    expect(body.questionId).toBe('q-2')
    expect(generateDoubtResponseMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(answerCreateMock).toHaveBeenCalledTimes(1)
    expect(consumeDailyFreeQuestionQuotaMock).toHaveBeenCalledWith('student-2')
    expect(refundDailyFreeQuestionQuotaMock).toHaveBeenCalledWith('student-2', 'column')
  })
})
