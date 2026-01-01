import buildProjectPrompt from './prompt'
import { validateProjectAssignment } from './schema'
import { ApprovalMetadata } from '../approval/types'
import { assertEditable, assertPublishable } from '../approval/guard'

export type ProjectInput = {
  syllabusId: string
  moduleId: string
  moduleTitle: string
  learningObjectives: string[]
}

export type LLM = { generate(prompt: string): Promise<string> | string }

export async function generateProject(input: ProjectInput, llm: LLM) {
  if (!llm || typeof llm.generate !== 'function') throw new Error('LLM adapter required')

  const prompt = buildProjectPrompt(input)
  const raw = await llm.generate(prompt)

  let parsed: unknown
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : String(raw))
  } catch (err) {
    throw new Error(`LLM returned invalid JSON: ${err}`)
  }

  try {
    return validateProjectAssignment(parsed)
  } catch (err) {
    throw new Error(`Project validation failed: ${err}`)
  }
}

export default generateProject

export function ensureProjectEditable(meta?: ApprovalMetadata) {
  if (!meta) return
  assertEditable(meta.status)
}

export function ensureProjectPublishable(meta?: ApprovalMetadata) {
  if (!meta) return
  assertPublishable(meta.status)
}
