import { prisma } from "@/lib/prisma"

export async function getNextVersion(params: {
  topicId: string
  difficulty?: string
  language?: string
  type: "note" | "test"
}) {
  if (params.type === "note") {
    const latest = await prisma.topicNote.findFirst({
      where: {
        topicId: params.topicId,
        language: params.language
      },
      orderBy: { version: "desc" }
    })
    return latest ? latest.version + 1 : 1
  }

  const latest = await prisma.generatedTest.findFirst({
    where: {
      topicId: params.topicId,
      difficulty: params.difficulty,
      language: params.language
    },
    orderBy: { version: "desc" }
  })

  return latest ? latest.version + 1 : 1
}
