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
})
