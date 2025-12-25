import buildLessonPrompt from './prompt'
import { validateLesson } from './schema'
import { ApprovalMetadata } from '../approval/types'
import { assertEditable, assertPublishable } from '../approval/guard'

export type GenerateLessonsInput = {
  syllabusId: string
  moduleId: string
  moduleTitle: string
  learningObjectives: string[]
  lessonCount: number
}

export type LLM = {
  generate(prompt: string): Promise<string> | string
}

export async function generateLessons(input: GenerateLessonsInput, llm: LLM): Promise<any[]> {
  if (!llm || typeof llm.generate !== 'function') {
    throw new Error('An LLM adapter with a `generate` method is required')
  }

  const prompt = buildLessonPrompt(input)
  const raw = await llm.generate(prompt)

  let parsed: unknown
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : String(raw))
  } catch (err) {
    throw new Error(`LLM returned invalid JSON: ${err}`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error('LLM must return a JSON array of Lesson objects')
  }

  const lessons = parsed.map((item, idx) => {
    try {
      return validateLesson(item)
    } catch (err) {
      throw new Error(`Lesson at index ${idx} failed validation: ${err}`)
    }
  })

  return lessons
}

export default generateLessons

export function ensureLessonEditable(meta?: ApprovalMetadata) {
  if (!meta) return
  assertEditable(meta.status)
}

export function ensureLessonPublishable(meta?: ApprovalMetadata) {
  if (!meta) return
  assertPublishable(meta.status)
}
