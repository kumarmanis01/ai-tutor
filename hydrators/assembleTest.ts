import { prisma } from "@/lib/prisma"

export async function assembleTest(topicId: string) {
  const tests = await prisma.generatedTest.findMany({
    where: { topicId },
    include: { questions: true }
  })

  if (tests.length === 0) return

  const mixedQuestions = [
    ...tests.filter(t => t.difficulty === "easy").flatMap(t => t.questions).slice(0, 5),
    ...tests.filter(t => t.difficulty === "medium").flatMap(t => t.questions).slice(0, 3),
    ...tests.filter(t => t.difficulty === "hard").flatMap(t => t.questions).slice(0, 2)
  ]

  await prisma.generatedTest.create({
    data: {
      topicId,
      title: "Mixed Practice Test",
      difficulty: "mixed",
      language: "en",
      questions: {
        create: mixedQuestions.map(q => ({
          type: q.type,
          question: q.question,
          options: q.options,
          answer: q.answer,
          marks: q.marks
        }))
      }
    }
  })
}
