import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { normalizeLanguage } from '@/lib/normalize'
import { logger } from '@/lib/logger'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function createChatCompletion(input: any) {
  return client.chat.completions.create(input)
}

export async function createSpeech(input: any) {
  return client.audio.speech.create(input)
}

export async function callLLM({ prompt, model = 'gpt-4o-mini', meta }: { prompt: string; model?: string; meta: any }) {
  try {
    const response: any = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })

    const usage = response.usage
    const content = response.choices?.[0]?.message?.content ?? ''

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
