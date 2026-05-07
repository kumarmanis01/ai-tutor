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
        followUpQuestion: 'Can you give one rational number?',
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
