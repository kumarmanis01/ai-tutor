import type {
  CourseSyllabus,
  AIMetadata,
  AssessmentHint,
  Lesson,
  Module,
  SkillLevel,
  TeachingStyle,
} from './types';
import { validateSyllabusJson } from './schema';
import { ZodError } from 'zod';

/**
 * Input shape for the syllabus generator. Kept minimal and explicit.
 */
export interface GenerateSyllabusInput {
  title: string;
  targetAudience?: string;
  skillLevel?: SkillLevel;
  timeBudgetMinutes?: number;
  teachingStyle?: TeachingStyle;
  constraints?: string[];
}

/**
 * Public API: generate a CourseSyllabus from structured input.
 *
 * Responsibilities:
 * - call LLM (stubbed here)
 * - validate output shape
 * - return typed `CourseSyllabus` or throw errors on validation failure
 */
export async function generateSyllabus(
  input: GenerateSyllabusInput,
  llmFn: (input: GenerateSyllabusInput) => Promise<unknown> = stubLLMGenerate,
): Promise<CourseSyllabus> {
  // 1) Call the provided LLM function (defaults to stub)
  const raw = await llmFn(input);

  // 2) Validate the raw output against the strict Zod schema
  try {
    const parsed = validateSyllabusJson(raw);
    return parsed as CourseSyllabus;
  } catch (err) {
    if (err instanceof ZodError) {
      const msgs = err.errors.map((e) => `${e.path.join('.')} ${e.message}`);
      throw new Error(`Syllabus schema validation failed: ${msgs.join('; ')}`);
    }
    throw err;
  }
}

/**
 * A tiny deterministic stub that simulates an LLM response. It returns
 * a JSON-serializable object matching the `CourseSyllabus` shape.
 *
 * Replace this with a real LLM call in Phase 7.
 */
export async function stubLLMGenerate(input: GenerateSyllabusInput): Promise<unknown> {
  const aiMeta: AIMetadata = {
    model: 'stub-model-1.0',
    promptId: 'syllabus-stub-v1',
    temperature: 0.0,
    provenance: 'stubbed-response',
  };

  const objectiveText = `Understand the fundamentals of ${input.title}`;

  const lesson: Lesson = {
    id: 'lesson-1',
    title: `Introduction to ${input.title}`,
    description: `Overview and core concepts for ${input.title}.`,
    objectives: [objectiveText],
    estimatedMinutes: Math.min(60, input.timeBudgetMinutes ?? 60),
    assessmentHints: [
      {
        id: 'assess-1',
        type: 'exercise',
        description: 'Quick hands-on exercise to check understanding',
        suggestedDurationMinutes: 15,
        aiMetadata: aiMeta,
      } as AssessmentHint,
    ],
    aiMetadata: aiMeta,
  };

  const mod: Module = {
    id: 'module-1',
    title: `Foundations of ${input.title}`,
    description: `Core foundational module for ${input.title}`,
    lessons: [lesson],
    estimatedMinutes: lesson.estimatedMinutes,
    aiMetadata: aiMeta,
  };

  const syllabus: CourseSyllabus = {
    id: `syllabus-${Date.now()}`,
    title: input.title,
    description: `Generated syllabus for ${input.title}`,
    targetAudience: input.targetAudience,
    skillLevel: input.skillLevel,
    timeBudgetMinutes: input.timeBudgetMinutes,
    teachingStyle: input.teachingStyle,
    constraints: input.constraints,
    modules: [mod],
    outcomes: [`Learner understands the basics of ${input.title}`],
    version: '0.1.0-draft',
    approved: false,
    createdBy: 'syllabus-generator-stub',
    createdAt: new Date().toISOString(),
    aiMetadata: aiMeta,
  };

  // Simulate async latency
  await new Promise((r) => setTimeout(r, 20));
  return syllabus;
}

/**
 * Very small runtime validator that checks presence and basic types for
 * fields required by the Phase 6 schema. This is intentionally lightweight
 * and defensive — a full JSON Schema + AJV validation can be added later.
 */
// Note: schema validation is delegated to `lib/syllabus/schema.ts` via validateSyllabusJson

export default generateSyllabus;
