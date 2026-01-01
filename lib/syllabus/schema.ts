import { z } from 'zod';

// Basic reusable shapes
const ResourceSchema = z
  .object({
    title: z.string(),
    url: z.string().url().optional(),
  })
  .strict();

const AIMetadataSchema = z.record(z.unknown()).optional();

const AssessmentHintSchema = z
  .object({
    id: z.string().optional(),
    type: z
      .enum(['quiz', 'project', 'assignment', 'exercise', 'placeholder'])
      .or(z.string())
      .optional(),
    description: z.string().optional(),
    suggestedDurationMinutes: z.number().int().nonnegative().optional(),
    weight: z.number().min(0).max(1).optional(),
    aiMetadata: AIMetadataSchema,
  })
  .strict();

// Lesson: objectives are arrays of strings per requirement
export const LessonSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    objectives: z.array(z.string()).nonempty(),
    prerequisites: z.array(z.string()).optional(),
    estimatedMinutes: z.number().int().nonnegative().optional(),
    resources: z.array(ResourceSchema).optional(),
    assessmentHints: z.array(AssessmentHintSchema).optional(),
    aiMetadata: AIMetadataSchema,
  })
  .strict();

export const ModuleSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    lessons: z.array(LessonSchema).nonempty(),
    estimatedMinutes: z.number().int().nonnegative().optional(),
    prerequisites: z.array(z.string()).optional(),
    aiMetadata: AIMetadataSchema,
  })
  .strict();

export const CourseSyllabusSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    targetAudience: z.string().optional(),
    skillLevel: z.string().optional(),
    timeBudgetMinutes: z.number().int().nonnegative().optional(),
    teachingStyle: z.string().optional(),
    constraints: z.array(z.string()).optional(),
    modules: z.array(ModuleSchema).nonempty(),
    prerequisites: z.array(z.string()).optional(),
    outcomes: z.array(z.string()).optional(),
    version: z.string().optional(),
    approved: z.boolean().optional(),
    approvalMetadata: z
      .object({
        approvedBy: z.string().optional(),
        approvedAt: z.string().optional(),
        versionId: z.string().optional(),
      })
      .strict()
      .optional(),
    createdBy: z.string().optional(),
    createdAt: z.string().optional(),
    aiMetadata: AIMetadataSchema,
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export type CourseSyllabus = z.infer<typeof CourseSyllabusSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type Lesson = z.infer<typeof LessonSchema>;

/**
 * Validate arbitrary JSON (e.g. LLM output) and return a typed syllabus.
 * Throws a ZodError when validation fails.
 */
export function validateSyllabusJson(data: unknown): CourseSyllabus {
  return CourseSyllabusSchema.parse(data);
}

export default CourseSyllabusSchema;
