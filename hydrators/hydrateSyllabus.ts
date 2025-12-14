import { prisma } from "@/lib/prisma"
import { callLLM } from "@/lib/callLLM"
import { toSlug } from "@/lib/slug"

export async function hydrateSyllabus(input: {
  board: string
  grade: number
  subject: string
  chapterId: string
}) {
  const paused = await prisma.systemSetting.findUnique({
    where: { key: "HYDRATION_PAUSED" }
  })
  if (paused?.value === true) return

  const prompt = `
Generate syllabus topics for:
Board: ${input.board}
Class: ${input.grade}
Subject: ${input.subject}

JSON only:
{
  "topics": [
    { "name": "", "order": 1 }
  ]
}
`

  const { content } = await callLLM({
    prompt,
    meta: {
      promptType: "syllabus",
      board: input.board,
      grade: input.grade,
      subject: input.subject
    }
  })

  const parsed = JSON.parse(content)

  for (const topic of parsed.topics) {
    const slug = toSlug(topic.name)

    await prisma.topicDef.upsert({
      where: {
        chapterId_slug: {
          chapterId: input.chapterId,
          slug
        }
      },
      update: {
        name: topic.name,
        order: topic.order
      },
      create: {
        name: topic.name,
        slug,
        order: topic.order,
        chapterId: input.chapterId,
        status: "draft",
        lifecycle: "active"
      }
    })
  }
}
