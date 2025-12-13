import { prisma } from "@/lib/prisma"
import { callLLM } from "@/lib/callLLM"

export async function hydrateSyllabus(topic: {
  board: string
  grade: number
  subject: string
  chapterId: string
}) {
  const prompt = `
Generate syllabus topics for:
Board: ${topic.board}
Class: ${topic.grade}
Subject: ${topic.subject}

Return JSON:
{ "topics": [{ "name": "...", "order": 1 }] }
`

  const { content } = await callLLM({
    prompt,
    meta: {
      promptType: "syllabus",
      board: topic.board,
      grade: topic.grade,
      subject: topic.subject
    }
  })

  const parsed = JSON.parse(content)

  for (const t of parsed.topics) {
    await prisma.topicDef.upsert({
      where: {
        slug_chapterId: {
          slug: t.name.toLowerCase().replace(/\s+/g, "-"),
          chapterId: topic.chapterId
        }
      },
      update: {},
      create: {
        name: t.name,
        slug: t.name.toLowerCase().replace(/\s+/g, "-"),
        order: t.order,
        chapterId: topic.chapterId
      }
    })
  }
}
