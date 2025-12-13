import { prisma } from "../lib/prisma"

export async function personalizeContent(studentId: string) {
  const profile = await prisma.studentLearningProfile.findUnique({
    where: { studentId }
  })

  const weakTopics = profile?.weakSubjects || []

  const recommendedTopics = await prisma.topicDef.findMany({
    where: {
      name: { in: weakTopics }
    },
    take: 5
  })

  for (const topic of recommendedTopics) {
    await prisma.contentRecommendation.upsert({
      where: {
        userId_contentId: {
          userId: studentId,
          contentId: topic.id
        }
      },
      update: {},
      create: {
        userId: studentId,
        contentId: topic.id
      }
    })
  }
}
