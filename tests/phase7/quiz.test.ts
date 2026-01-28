import { generateQuizFromLesson } from '@/lib/content/quiz/generator'
import { createMockLLM } from '@/lib/content/lesson/mockLLM'

const lesson = { lessonId: 'l1', title: 'T', objectives: ['o1'] }

const validQuiz = {
  lessonId: 'l1',
  questions: [
    {
      question: 'What is X?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
      explanation: 'Because of reasons.'
    }
  ]
}

test('valid quiz generation passes', async () => {
  const llm = createMockLLM(JSON.stringify(validQuiz))
  const q = await generateQuizFromLesson(lesson, llm)
  expect(q.lessonId).toBe('l1')
  expect(q.questions.length).toBe(1)
})

test('invalid JSON from LLM throws', async () => {
  const llm = createMockLLM('not-json')
  await expect(generateQuizFromLesson(lesson, llm)).rejects.toThrow(/invalid JSON/i)
})

test('schema violation (not 4 options) throws', async () => {
  const bad = { ...validQuiz, questions: [{ ...validQuiz.questions[0], options: ['A','B'] }] }
  const llm = createMockLLM(JSON.stringify(bad))
  await expect(generateQuizFromLesson(lesson, llm)).rejects.toThrow(/Quiz validation failed/i)
})
