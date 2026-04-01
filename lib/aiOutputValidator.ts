import Ajv from 'ajv'
import { ZodError, ZodIssue } from 'zod'
import zodSchemas from './ai/prompts/schemas'
import { logger } from '@/lib/logger.js'

export class ValidationError extends Error { public type: string; public details?: any; constructor(type: string, message: string, details?: any) { super(message); this.name = 'ValidationError'; this.type = type; this.details = details } }
export class SchemaInvalidError extends ValidationError { constructor(message: string, details?: any) { super('SCHEMA_INVALID', message, details) } }
export class PlaceholderContentError extends ValidationError { constructor(message: string, details?: any) { super('PLACEHOLDER_CONTENT', message, details) } }
export class SemanticWeaknessError extends ValidationError { constructor(message: string, details?: any) { super('SEMANTIC_WEAKNESS', message, details) } }
export class ContextMismatchError extends ValidationError { constructor(message: string, details?: any) { super('CONTEXT_MISMATCH', message, details) } }

const ajv = new Ajv({ allErrors: true } as any)

// Keep lightweight AJV validators as fallback for older prompt shapes
const legacyNotesSchema = {
  type: 'object',
  properties: { title: { type: 'string' }, notes: { type: 'string' }, summary: { type: 'string' } },
  required: ['title', 'notes']
}
const legacyQuestionsSchema = {
  type: 'object',
  properties: { difficulty: { type: 'string' }, questions: { type: 'array' } },
  required: ['questions']
}

const validateLegacyNotes = ajv.compile(legacyNotesSchema as any)
const validateLegacyQuestions = ajv.compile(legacyQuestionsSchema as any)

// Only flag patterns that clearly indicate stub/placeholder content, not legitimate
// educational phrases like "Introduction to Carbon Compounds" or "students will learn".
const PLACEHOLDER_PATTERNS = [
  /content coming soon/i,
  /interactive content coming soon/i,
  /to be added later/i,
  /placeholder/i,
  /lorem ipsum/i,
  /\[insert .+\]/i,
  /TBD/,
]

function scanForPlaceholders(obj: any): string | null {
  if (obj == null) return null
  if (typeof obj === 'string') {
    for (const p of PLACEHOLDER_PATTERNS) if (p.test(obj)) return obj
    return null
  }
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const r = scanForPlaceholders(it); if (r) return r
    }
    return null
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const r = scanForPlaceholders(obj[k]); if (r) return r
    }
    return null
  }
  return null
}

export function validateOrThrow(parsed: any, ctx: { jobType: string, language?: string, difficulty?: string, subject?: string, topic?: string, grade?: number }) {
  if (!parsed) throw new SchemaInvalidError('empty_response')
  // Schema validation: prefer Zod strict schemas for new prompt types
  try {
    if (ctx.jobType === 'notes') {
      zodSchemas.NoteSchema.parse(parsed)
    } else if (ctx.jobType === 'questions' || ctx.jobType === 'tests') {
      zodSchemas.QuestionsSchema.parse(parsed)
    } else if (ctx.jobType === 'bilingual') {
      zodSchemas.BilingualNotesSchema.parse(parsed)
    } else if (ctx.jobType === 'syllabus') {
      zodSchemas.SyllabusSchema.parse(parsed)
    } else if (ctx.jobType === 'chapters') {
      zodSchemas.ChaptersArraySchema.parse(parsed)
    } else if (ctx.jobType === 'assemble') {
      zodSchemas.AssembleSchema.parse(parsed)
    } else {
      // Fallback to legacy Ajv validators for older flows
      if (ctx.jobType === 'notes') {
        const ok = validateLegacyNotes(parsed)
        if (!ok) throw new SchemaInvalidError('notes_schema_invalid', validateLegacyNotes.errors)
      } else if (ctx.jobType === 'questions' || ctx.jobType === 'tests' || ctx.jobType === 'assemble') {
        const ok = validateLegacyQuestions(parsed)
        if (!ok) throw new SchemaInvalidError('questions_schema_invalid', validateLegacyQuestions.errors)
      } else {
        throw new SchemaInvalidError('jobtype_unknown')
      }
    }
  } catch (zErr: any) {
    if (zErr instanceof ZodError) {
      for (const issue of zErr.errors as ZodIssue[]) {
        logger.error('[QUESTION_SCHEMA_FAILURE]', {
          field: issue.path.join('.'),
          receivedValue: issue.code === 'invalid_type' ? (issue as any).received : undefined,
          expectedSchema: issue.message,
          code: issue.code,
          jobType: ctx.jobType,
          topic: ctx.topic,
        })
      }
      throw new SchemaInvalidError('zod_schema_invalid', zErr.errors)
    }
    throw zErr
  }

  // Placeholder detection
  const placeholder = scanForPlaceholders(parsed)
  if (placeholder) throw new PlaceholderContentError('PLACEHOLDER_CONTENT_DETECTED', { snippet: placeholder })

  // Semantic checks (simple heuristics)
  if (ctx.jobType === 'notes') {
    // Support both legacy `notes` field and the new schema-first NoteSchema
    let notesText = ''

    // Legacy shape: single `notes` string
    if (typeof parsed.notes === 'string') {
      notesText += ` ${parsed.notes}`
    }

    // New schema-first shape (see lib/ai/prompts/schemas.ts: NoteSchema)
    if (typeof parsed.explanation === 'string') {
      notesText += ` ${parsed.explanation}`
    }
    if (typeof parsed.concept === 'string') {
      notesText += ` ${parsed.concept}`
    }
    if (typeof parsed.example === 'string') {
      notesText += ` ${parsed.example}`
    }
    if (Array.isArray(parsed.keyPoints)) {
      notesText += ` ${parsed.keyPoints.join(' ')}`
    }
    if (Array.isArray(parsed.commonMistakes)) {
      notesText += ` ${parsed.commonMistakes.join(' ')}`
    }

    // Require a minimum amount of real content to avoid stubby notes.
    // 600 chars is a conservative floor -- a genuine classroom-quality explanation
    // with one worked example should easily exceed this.
    if (typeof notesText === 'string' && notesText.trim().length < 600) {
      throw new SemanticWeaknessError('notes_too_short')
    }
  }

  if (ctx.jobType === 'questions' || ctx.jobType === 'tests' || ctx.jobType === 'assemble') {
    const qs = parsed.questions || []
    if (!Array.isArray(qs) || qs.length === 0) throw new SemanticWeaknessError('no_questions')
    for (const q of qs) {
      const expl = q.explanation ? String(q.explanation).trim() : ''
      if (expl && expl !== 'Explanation not provided.' && expl.length < 20) {
        throw new SemanticWeaknessError('shallow_question_explanation', { question: q.question, explanationLength: expl.length })
      }
    }
    // difficulty alignment (case-insensitive)
    if (ctx.difficulty && parsed.difficulty && ctx.difficulty.toLowerCase() !== String(parsed.difficulty).toLowerCase()) {
      throw new ContextMismatchError('difficulty_mismatch', { expected: ctx.difficulty, got: parsed.difficulty })
    }
  }

  // Context validation: language check
  if (ctx.language) {
    const langField = (parsed.language || parsed.lang || null)
    if (langField && String(langField).toLowerCase() !== String(ctx.language).toLowerCase()) {
      throw new ContextMismatchError('language_mismatch', { expected: ctx.language, got: langField })
    }
  }

  // If all checks pass, return true
  return true
}

const aiOutputValidator = { validateOrThrow }
export default aiOutputValidator
