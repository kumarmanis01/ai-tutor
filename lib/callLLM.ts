/**
 * COPILOT RULES — callLLM
 *
 * - Only calls AI providers
 * - No DB mutations except AIContentLog
 * - Must log success and failure
 * - Must not infer language/difficulty
 * 
 * Mandatory Rules
 * import { LanguageCode } from "@prisma/client";
 * 
 * language: meta.language as LanguageCode | undefined

 */

import OpenAI from "openai"
import { prisma } from "./prisma"
import { normalizeLanguage } from "@/lib/normalize";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type CallLLMArgs = {
  prompt: string
  model?: string
  meta: {
    promptType: string
    board?: string
    grade?: number
    subject?: string
    chapter?: string
    topic?: string
    language?: string
    topicId?: string
  }
}

export async function callLLM({ prompt, model = "gpt-4o-mini", meta }: CallLLMArgs) {
  let logId: string | null = null

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    })

    const usage = response.usage
    const content = response.choices[0].message.content || ""

    const costUsd =
      ((usage?.prompt_tokens || 0) * 0.00000015) +
      ((usage?.completion_tokens || 0) * 0.0000006)

    const log = await prisma.aIContentLog.create({
      data: {
        model,
        promptType: meta.promptType,
        board: meta.board,
        grade: meta.grade,
        subject: meta.subject,
        chapter: meta.chapter,
        topic: meta.topic,
        language: normalizeLanguage(meta.language),
        topicId: meta.topicId,
        tokensIn: usage?.prompt_tokens,
        tokensOut: usage?.completion_tokens,
        tokensUsed: usage?.total_tokens,
        costUsd,
        success: true,
        status: "success",
        requestBody: { prompt },
        responseBody: JSON.parse(JSON.stringify(response))
      }
    })

    logId = log.id
    return { content, logId }

  } catch (error: any) {
    await prisma.aIContentLog.create({
      data: {
        model,
        promptType: meta.promptType,
        board: meta.board,
        grade: meta.grade,
        subject: meta.subject,
        chapter: meta.chapter,
        topic: meta.topic,
        language: normalizeLanguage(meta.language),
        topicId: meta.topicId,
        success: false,
        status: "failed",
        error: error.message
      }
    })
    throw error
  }
}
