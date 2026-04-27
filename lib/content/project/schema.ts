import { z } from 'zod'

const DeliverableSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1)
})

const RubricItemSchema = z.object({
  criteria: z.string().min(3),
  weight: z.number().int().min(0),
  expectations: z.string().min(5)
})

export const ProjectAssignmentSchema = z.object({
  id: z.string(),
  syllabusId: z.string(),
  moduleId: z.string(),

  title: z.string().min(5),
  description: z.string().optional(),

  problemStatement: z.string().min(80),

  constraints: z.array(z.string()).min(1),

  deliverables: z.array(DeliverableSchema).min(1),

  evaluationRubric: z.array(RubricItemSchema).min(2)
    .refine((arr) => arr.reduce((s, it) => s + it.weight, 0) === 100, {
      message: 'Total rubric weight must equal exactly 100'
    }),

  difficulty: z.enum(['beginner', 'intermediate', 'advanced'])
})

export type ProjectAssignment = z.infer<typeof ProjectAssignmentSchema>

export function validateProjectAssignment(data: unknown): ProjectAssignment {
  const res = ProjectAssignmentSchema.safeParse(data)
  if (!res.success) throw res.error
  return res.data
}

export default validateProjectAssignment
