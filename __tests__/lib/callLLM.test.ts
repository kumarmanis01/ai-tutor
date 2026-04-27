import { createChatCompletion } from '@/lib/callLLM'

describe('callLLM guard', () => {
  test('createChatCompletion throws when ALLOW_LLM_CALLS not set', async () => {
    delete process.env.ALLOW_LLM_CALLS
    await expect(createChatCompletion({} as any)).rejects.toThrow(/LLM calls are restricted/)
  })
})
