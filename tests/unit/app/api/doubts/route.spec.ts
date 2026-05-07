/**
 * FILE OBJECTIVE:
 * - Validate doubts API hybrid flow: short synchronous wait for worker-completed answers, else async queued response.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/doubts/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | add coverage for fast-answer and queued-response doubts API paths
 */

describe('doubts route hybrid worker flow', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env.DOUBTS_SYNC_WAIT_MS = '5'
    process.env.DOUBTS_POLL_INTERVAL_MS = '1'
  })

  it('returns immediate answer when worker updates question quickly', async () => {
    const findUniqueMock = jest
      .fn()
      .mockResolvedValueOnce({ grade: '8', board: 'CBSE', language: 'en' })
      .mockResolvedValueOnce({ status: 'processing', answerSummary: null, aiMetadata: null })
      .mockResolvedValueOnce({
        status: 'answered',
        answerSummary: 'Real numbers include rational and irrational numbers.',
        aiMetadata: { followUpQuestion: 'Can you name one irrational number?', confidenceLevel: 'high' },
      })

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({ user: { id: 'student-1', grade: '8' } }),
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/ai/prompts/doubts', () => ({
      buildDoubtsPrompt: jest.fn(() => 'PROMPT'),
      isOffTopicQuestion: jest.fn(() => false),
      getOffTopicRedirect: jest.fn(),
    }))
    jest.doMock('@/queues/aiQueue', () => ({
      getAIRequestQueue: () => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) }),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: findUniqueMock },
        studentQuestion: {
          findFirst: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'q-1', aiMetadata: null }),
          findUnique: findUniqueMock,
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
      body: JSON.stringify({ question: 'What are real numbers?', subject: 'Math' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questionId).toBe('q-1')
    expect(body.response).toContain('Real numbers')
    expect(body.confidenceLevel).toBe('high')
  })

  it('returns 202 queued when worker has not completed within short wait window', async () => {
    const findUniqueMock = jest
      .fn()
      .mockResolvedValueOnce({ grade: '8', board: 'CBSE', language: 'en' })
      .mockResolvedValue({ status: 'processing', answerSummary: null, aiMetadata: null })

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: async () => ({ user: { id: 'student-2', grade: '8' } }),
    }))
    jest.doMock('@/lib/logger', () => ({ logger: { logAPI: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
    jest.doMock('@/lib/ai/prompts/doubts', () => ({
      buildDoubtsPrompt: jest.fn(() => 'PROMPT'),
      isOffTopicQuestion: jest.fn(() => false),
      getOffTopicRedirect: jest.fn(),
    }))
    jest.doMock('@/queues/aiQueue', () => ({
      getAIRequestQueue: () => ({ add: jest.fn().mockResolvedValue({ id: 'job-2' }) }),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        user: { findUnique: findUniqueMock },
        studentQuestion: {
          findFirst: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'q-2', aiMetadata: null }),
          findUnique: findUniqueMock,
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
      body: JSON.stringify({ question: 'Explain quadratic equations', subject: 'Math' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.status).toBe('queued')
    expect(body.questionId).toBe('q-2')
  })
})
