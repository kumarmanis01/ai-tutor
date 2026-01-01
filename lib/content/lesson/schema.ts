import { z } from 'zod'

export const LessonSchema = z.object({
  id: z.string(),
  syllabusId: z.string(),
  moduleId: z.string(),
  lessonIndex: z.number().int(),

  title: z.string().min(5),
  durationMinutes: z.number().int().min(5),

  objectives: z.array(z.string()).min(1),

  explanation: z.object({
    overview: z.string().min(50),
    concepts: z.array(
      z.object({
        title: z.string(),
        explanation: z.string().min(50),
        example: z.string().optional()
      })
    ).min(1)
  }),

  keyTakeaways: z.array(z.string()).min(2),

  practice: z.object({
    prompt: z.string().min(30),
    expectedOutcome: z.string().min(30)
  }),

  metadata: z.object({
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    prerequisites: z.array(z.string()).optional()
  })
})

export type Lesson = z.infer<typeof LessonSchema>

export function validateLesson(data: unknown): Lesson {
  const result = LessonSchema.safeParse(data)
  if (!result.success) throw result.error
  return result.data
}

export default validateLesson
