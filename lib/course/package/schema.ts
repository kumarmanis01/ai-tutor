import { z } from 'zod'
import { LessonSchema } from '../../content/lesson/schema'
import { QuizSchema } from '../../content/quiz/schema'
import { ProjectAssignmentSchema } from '../../content/project/schema'

const CourseModuleSchema = z.object({
  moduleId: z.string(),
  title: z.string().min(1),
  lessons: z.array(LessonSchema).min(1),
  quizzes: z.array(QuizSchema).optional(),
  projects: z.array(ProjectAssignmentSchema).optional()
}).refine((m) => (m.quizzes?.length || 0) + (m.projects?.length || 0) >= 1, {
  message: 'Each module must have at least one quiz or project'
})

export const CoursePackageSchema = z.object({
  id: z.string(),
  syllabusId: z.string(),
  version: z.number().int().min(1),

  title: z.string().min(1),
  description: z.string().optional(),

  modules: z.array(CourseModuleSchema).min(1),

  createdAt: z.string(),
  frozen: z.literal(true)
})

export type CoursePackage = z.infer<typeof CoursePackageSchema>

export function validateCoursePackage(data: unknown): CoursePackage {
  const res = CoursePackageSchema.safeParse(data)
  if (!res.success) throw res.error
  return res.data
}

export default validateCoursePackage
