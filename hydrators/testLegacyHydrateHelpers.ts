import { callLLM } from '@/lib/callLLM'
import { prisma } from '@/lib/prisma'

export async function runLegacyNotesHydrate(topicId: string, language: string) {
  const llmRes: any = await callLLM({ prompt: 'test', meta: {} })
  const parsed = llmRes?.content ? JSON.parse(llmRes.content) : null
  if (parsed) {
    await prisma.topicNote.create({ data: { topicId, language, title: parsed.title, contentJson: parsed.content } })
    // Record title for downstream test helpers (questions) to use
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g: any = global as any
      g.__TEST_TOPIC_TITLES__ = g.__TEST_TOPIC_TITLES__ || {}
      g.__TEST_TOPIC_TITLES__[topicId] = parsed.title
    } catch {}
  }
}

export async function runLegacyQuestionsHydrate(topicId: string, difficulty: string, language: string) {
  // Try to fetch a recorded title from the notes helper first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = global as any
  const recorded = g.__TEST_TOPIC_TITLES__ ? g.__TEST_TOPIC_TITLES__[topicId] : undefined
  const topic = await prisma.topicDef.findUnique({ where: { id: topicId } })
  const llmRes: any = await callLLM({ prompt: 'test', meta: {} })
  const parsed = llmRes?.content ? JSON.parse(llmRes.content) : null
  const title = parsed?.title ?? recorded ?? (topic ? `${topic.name} - Generated Test` : undefined)
  if (parsed) {
    // Minimal behavior for tests: create generatedTest and generatedQuestion entries
    const test = await prisma.generatedTest.create({ data: { topicId, language, difficulty, title, questions: parsed.questions || [] } })
    if (Array.isArray(parsed.questions)) {
      for (const q of parsed.questions) {
        await prisma.generatedQuestion.create({ data: { testId: test.id, question: q.question, options: q.options, answer: q.answer, type: q.type } })
      }
    }
  }
}
