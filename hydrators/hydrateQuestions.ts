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
import { normalizeDifficulty, normalizeLanguage } from "@/lib/normalize"

export async function hydrateQuestions(
  topicId: string,
  difficulty: ReturnType<typeof normalizeDifficulty>,
  language: ReturnType<typeof normalizeLanguage>
) {
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

  const approved = await prisma.generatedTest.findFirst({
    where: {
      topicId,
      difficulty,
      language,
      status: "approved"
    }
  })

  const version = approved
    ? await getNextVersion({
        topicId,
        difficulty,
        language,
        type: "test"
      })
    : 1

  const prompt = `
Generate 5 ${difficulty} questions.
Topic: ${topic.name}
Board: ${topic.chapter.subject.class.board.name}
Class: ${topic.chapter.subject.class.grade}
Subject: ${topic.chapter.subject.name}
Language: ${language}

JSON only:
{
  "questions": [
    {
      "type": "mcq",
      "question": "",
      "options": [],
      "answer": ""
    }
  ]
}
`

  const { content } = await callLLM({
    prompt,
    meta: {
      promptType: "questions",
      board: topic.chapter.subject.class.board.name,
      grade: topic.chapter.subject.class.grade,
      subject: topic.chapter.subject.name,
      topic: topic.name,
      language
    }
  })

  const parsed = JSON.parse(content)

  const test = await prisma.generatedTest.create({
    data: {
      topicId,
      difficulty,
      language,
      version,
      title: `${topic.name} (${difficulty})`,
      status: "draft"
    }
  })

  for (const q of parsed.questions) {
    await prisma.generatedQuestion.create({
      data: {
        testId: test.id,
        type: q.type,
        question: q.question,
        options: q.options,
        answer: q.answer
      }
    })
  }
}
