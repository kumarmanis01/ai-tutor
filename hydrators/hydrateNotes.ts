/**
 * COPILOT RULES — HYDRATOR
 *
 * - Hydrators only enqueue jobs
 * - No AI calls allowed here
 * - Must be idempotent
 * - Must check DB before enqueue
 * - Never mutate existing content
 * example
 * await prisma.hydrationJob.upsert({
 *  where: { jobType_unique },
 *   update: {},
 *   create: {
 *     jobType: "notes",
 *     topicId,
 *     language,
 *   },
 * });
 */

import { prisma } from "@/lib/prisma"
import { callLLM } from "@/lib/callLLM"
import { getNextVersion } from "@/lib/getNextVersion"
import { logger } from "@/lib/logger"

const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1'

export async function hydrateNotes(
  topicId: string,
  language: "en" | "hi"
) {
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] hydrateNotes called', { topicId, language })

  const topic = await prisma.topicDef.findUnique({
    where: { id: topicId },
    include: {
      chapter: {
        include: {
          subject: {
            include: {
              class: { include: { board: true } }
            }
          }
        }
      }
    }
  })
  if (!topic) throw new Error("Topic missing")

  const approved = await prisma.topicNote.findFirst({
    where: {
      topicId,
      language,
      status: "approved"
    }
  })

  const version = approved
    ? await getNextVersion({ topicId, language, type: "note" })
    : 1

  const prompt = `
Explain "${topic.name}"
Board: ${topic.chapter.subject.class.board.name}
Class: ${topic.chapter.subject.class.grade}
Subject: ${topic.chapter.subject.name}
Language: ${language}

JSON only:
{
  "title": "",
  "content": {}
}
`

  const { content } = await callLLM({
    prompt,
    meta: {
      promptType: "notes",
      board: topic.chapter.subject.class.board.name,
      grade: topic.chapter.subject.class.grade,
      subject: topic.chapter.subject.name,
      topic: topic.name,
      language
    }
  })

  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] hydrateNotes LLM content length', { length: content?.length })

  const parsed = JSON.parse(content)

  await prisma.topicNote.create({
    data: {
      topicId,
      language,
      version,
      title: parsed.title,
      contentJson: parsed.content,
      source: "ai",
      status: "draft"
    }
  })
}
