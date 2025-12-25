import buildQuizPrompt from './prompt'
import { validateQuiz } from './schema'
import { ApprovalMetadata } from '../approval/types'
import { assertEditable, assertPublishable } from '../approval/guard'

export type LessonForQuiz = {
  lessonId: string
  title: string
  objectives: string[]
}

export type LLM = { generate(prompt: string): Promise<string> | string }

export async function generateQuizFromLesson(lesson: LessonForQuiz, llm: LLM) {
  if (!llm || typeof llm.generate !== 'function') throw new Error('LLM adapter required')

  const prompt = buildQuizPrompt(lesson)
  const raw = await llm.generate(prompt)

  let parsed: unknown
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : String(raw))
  } catch (err) {
    throw new Error(`LLM returned invalid JSON: ${err}`)
  }

  try {
    return validateQuiz(parsed)
  } catch (err) {
    throw new Error(`Quiz validation failed: ${err}`)
  }
}

export default generateQuizFromLesson

export function ensureQuizEditable(meta?: ApprovalMetadata) {
  if (!meta) return
  assertEditable(meta.status)
}

export function ensureQuizPublishable(meta?: ApprovalMetadata) {
  if (!meta) return
  assertPublishable(meta.status)
}
