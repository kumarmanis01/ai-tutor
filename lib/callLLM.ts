import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { normalizeLanguage } from '@/lib/normalize'
import { logger } from '@/lib/logger'

// Safety: only allow calling LLMs from worker processes. Workers must set
// `ALLOW_LLM_CALLS=1` in their environment (see worker/bootstrap.ts).
function ensureWorkerAllowed() {
  if (process.env.ALLOW_LLM_CALLS !== '1') {
    throw new Error('LLM calls are restricted to worker processes. Set ALLOW_LLM_CALLS=1 in worker runtime.')
  }
}

let client: any = null
function getClient() {
  if (!client) {
    ensureWorkerAllowed()
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export async function createChatCompletion(input: any) {
  const c = getClient()
  return c.chat.completions.create(input)
}

export async function createSpeech(input: any) {
  const c = getClient()
  return c.audio.speech.create(input)
}

export async function callLLM({ prompt, model = 'gpt-4o-mini', meta }: { prompt: string; model?: string; meta: any }) {
  ensureWorkerAllowed()
  const client = getClient()
  const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1'
  try {
    const response: any = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })

    const usage = response.usage
    const content = response.choices?.[0]?.message?.content ?? ''

    if (HYDRATION_DEBUG) {
      try {
        // lightweight debug log: prompt length and sample of content
        logger.debug('[ai][DEBUG] callLLM prompt length', { promptLength: (prompt || '').length })
        logger.debug('[ai][DEBUG] callLLM response length', { responseLength: (content || '').length })
        logger.info('callLLM debug', { promptLength: (prompt || '').length, responseLength: (content || '').length, meta })
      } catch {
        // ignore logging errors
      }
    }

    const costUsd = ((usage?.prompt_tokens || 0) * 0.00000015) + ((usage?.completion_tokens || 0) * 0.0000006)

    try {
      await prisma.aIContentLog.create({
        data: {
          model,
          promptType: meta?.promptType,
          board: meta?.board,
          grade: meta?.grade,
          subject: meta?.subject,
          chapter: meta?.chapter,
          topic: meta?.topic,
          language: normalizeLanguage(meta?.language),
          topicId: meta?.topicId,
          tokensIn: usage?.prompt_tokens,
          tokensOut: usage?.completion_tokens,
          tokensUsed: usage?.total_tokens,
          costUsd,
          success: true,
          status: 'success',
          requestBody: { prompt },
          responseBody: JSON.parse(JSON.stringify(response)),
        },
      })
    } catch (e) {
      logger.error('Failed to write AIContentLog', { error: String(e) })
    }

    return { content }
  } catch (error: any) {
    try {
      await prisma.aIContentLog.create({
        data: {
          model,
          promptType: meta?.promptType,
          board: meta?.board,
          grade: meta?.grade,
          subject: meta?.subject,
          chapter: meta?.chapter,
          topic: meta?.topic,
          language: normalizeLanguage(meta?.language),
          topicId: meta?.topicId,
          success: false,
          status: 'failed',
          error: error?.message ?? String(error),
        },
      })
    } catch (e) {
      logger.error('Failed to write AIContentLog on error path', { error: String(e) })
    }
    throw error
  }
}
