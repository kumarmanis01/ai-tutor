import { z } from 'zod'

export const QuizSchema = z.object({
  lessonId: z.string(),
  questions: z.array(
    z.object({
      question: z.string().min(5),
      options: z.array(z.string()).length(4),
      correctIndex: z.number().int().min(0).max(3),
      explanation: z.string().min(10)
    })
  ).min(1)
})

export type Quiz = z.infer<typeof QuizSchema>

export function validateQuiz(data: unknown): Quiz {
  const res = QuizSchema.safeParse(data)
  if (!res.success) throw res.error
  return res.data
}

export default validateQuiz
