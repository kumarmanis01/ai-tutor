import Ajv from 'ajv'

export class ValidationError extends Error { public type: string; public details?: any; constructor(type: string, message: string, details?: any) { super(message); this.name = 'ValidationError'; this.type = type; this.details = details } }
export class SchemaInvalidError extends ValidationError { constructor(message: string, details?: any) { super('SCHEMA_INVALID', message, details) } }
export class PlaceholderContentError extends ValidationError { constructor(message: string, details?: any) { super('PLACEHOLDER_CONTENT', message, details) } }
export class SemanticWeaknessError extends ValidationError { constructor(message: string, details?: any) { super('SEMANTIC_WEAKNESS', message, details) } }
export class ContextMismatchError extends ValidationError { constructor(message: string, details?: any) { super('CONTEXT_MISMATCH', message, details) } }

const ajv = new Ajv({ allErrors: true } as any)

// Basic schemas for job types
// Must match the JSON schema requested in prompts/notes.md
const notesSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    notes: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['title', 'notes']
}

const questionsSchema = {
  type: 'object',
  properties: {
    difficulty: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
          explanation: { type: 'string' }
        },
        required: ['question', 'answer']
      }
    }
  },
  required: ['questions']
}

const validateNotes = ajv.compile(notesSchema as any)
const validateQuestions = ajv.compile(questionsSchema as any)

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

  // Schema validation
  if (ctx.jobType === 'notes') {
    const ok = validateNotes(parsed)
    if (!ok) throw new SchemaInvalidError('notes_schema_invalid', validateNotes.errors)
  } else if (ctx.jobType === 'questions' || ctx.jobType === 'tests' || ctx.jobType === 'assemble') {
    const ok = validateQuestions(parsed)
    if (!ok) throw new SchemaInvalidError('questions_schema_invalid', validateQuestions.errors)
  } else {
    // unknown job types: fail safe
    throw new SchemaInvalidError('jobtype_unknown')
  }

  // Placeholder detection
  const placeholder = scanForPlaceholders(parsed)
  if (placeholder) throw new PlaceholderContentError('PLACEHOLDER_CONTENT_DETECTED', { snippet: placeholder })

  // Semantic checks (simple heuristics)
  if (ctx.jobType === 'notes') {
    // The LLM returns `notes` as a string (per prompts/notes.md schema)
    const notesText = parsed.notes || ''
    if (typeof notesText === 'string' && notesText.trim().length < 100) {
      throw new SemanticWeaknessError('notes_too_short')
    }
  }

  if (ctx.jobType === 'questions' || ctx.jobType === 'tests' || ctx.jobType === 'assemble') {
    const qs = parsed.questions || []
    if (!Array.isArray(qs) || qs.length === 0) throw new SemanticWeaknessError('no_questions')
    for (const q of qs) {
      if (!q.explanation || String(q.explanation).trim().length < 20) throw new SemanticWeaknessError('missing_question_explanation', { question: q.question })
    }
    // difficulty alignment
    if (ctx.difficulty && parsed.difficulty && ctx.difficulty !== parsed.difficulty) {
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
