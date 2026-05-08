/**
 * FILE OBJECTIVE:
 * - Validate callLLM logging and analytics side effects for successful invocations.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/callLLM.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-08T11:36:00Z | copilot | add coverage for AIContentLog grade normalization from string to int
 */

jest.mock('@/lib/prisma', () => ({
  prisma: { analyticsEvent: { create: jest.fn() }, aITutorTurnLog: { create: jest.fn() }, aIContentLog: { create: jest.fn() } },
}))
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
jest.mock('openai', () => {
  return function OpenAIMock() {
    return {
      chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }) } },
    }
  }
})

import { callLLM } from '@/lib/callLLM'
import { prisma } from '@/lib/prisma'

describe('callLLM analytics', () => {
  afterEach(() => jest.clearAllMocks())

  it('records analyticsEvent on successful LLM call', async () => {
    const res = await callLLM({ prompt: 'hello', model: 'gpt-test', meta: { callType: 'test:call', sessionId: 's1', studentId: 'u1' } })
    expect(res).toHaveProperty('content')
    expect(prisma.analyticsEvent.create).toHaveBeenCalled()
  })

  it('normalizes string grade to int in AIContentLog writes', async () => {
    const res = await callLLM({
      prompt: 'explain integers',
      model: 'gpt-test',
      meta: {
        promptType: 'doubts',
        allowApiDirect: true,
        board: 'cbse',
        grade: '6',
        subject: 'Mathematics',
        chapter: 'Number System',
        topic: 'Natural Numbers',
        language: 'en',
      },
    })

    expect(res).toHaveProperty('content')
    expect(prisma.aIContentLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptType: 'doubts',
          grade: 6,
        }),
      }),
    )
  })
})
