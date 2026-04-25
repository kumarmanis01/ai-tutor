import Ajv from 'ajv';
import { ZodError, ZodIssue } from 'zod';
import zodSchemas from './ai/prompts/schemas';
import { logger } from '@/lib/logger.js';

export class ValidationError extends Error {
  public type: string;
  public details?: any;
  constructor(type: string, message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.type = type;
    this.details = details;
  }
}
export class SchemaInvalidError extends ValidationError {
  constructor(message: string, details?: any) {
    super('SCHEMA_INVALID', message, details);
  }
}
export class PlaceholderContentError extends ValidationError {
  constructor(message: string, details?: any) {
    super('PLACEHOLDER_CONTENT', message, details);
  }
}
export class SemanticWeaknessError extends ValidationError {
  constructor(message: string, details?: any) {
    super('SEMANTIC_WEAKNESS', message, details);
  }
}
export class ContextMismatchError extends ValidationError {
  constructor(message: string, details?: any) {
    super('CONTEXT_MISMATCH', message, details);
  }
}

const ajv = new Ajv({ allErrors: true } as any);

// Keep lightweight AJV validators as fallback for older prompt shapes
const legacyNotesSchema = {
  type: 'object',
  properties: { title: { type: 'string' }, notes: { type: 'string' }, summary: { type: 'string' } },
  required: ['title', 'notes'],
};
const legacyQuestionsSchema = {
  type: 'object',
  properties: { difficulty: { type: 'string' }, questions: { type: 'array' } },
  required: ['questions'],
};

const validateLegacyNotes = ajv.compile(legacyNotesSchema as any);
const validateLegacyQuestions = ajv.compile(legacyQuestionsSchema as any);

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
];

function scanForPlaceholders(obj: any): string | null {
  if (obj == null) return null;
  if (typeof obj === 'string') {
    for (const p of PLACEHOLDER_PATTERNS) if (p.test(obj)) return obj;
    return null;
  }
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const r = scanForPlaceholders(it);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const r = scanForPlaceholders(obj[k]);
      if (r) return r;
    }
    return null;
  }
  return null;
}

export function validateOrThrow(
  parsed: any,
  ctx: {
    jobType: string;
    language?: string;
    difficulty?: string;
    subject?: string;
    topic?: string;
    grade?: number;
    difficultyLevel?: 'foundation' | 'standard' | 'advanced';
  }
) {
  if (!parsed) throw new SchemaInvalidError('empty_response');
  // Schema validation: prefer Zod strict schemas for new prompt types
  try {
    if (ctx.jobType === 'notes') {
      // Auto-detect format: VidyaNotesSchema (sections array) vs legacy NoteSchema (flat fields)
      if (Array.isArray(parsed.sections)) {
        zodSchemas.VidyaNotesSchema.parse(parsed);
      } else {
        zodSchemas.NoteSchema.parse(parsed);
      }
    } else if (ctx.jobType === 'questions' || ctx.jobType === 'tests') {
      zodSchemas.QuestionsSchema.parse(parsed);
    } else if (ctx.jobType === 'bilingual') {
      zodSchemas.BilingualNotesSchema.parse(parsed);
    } else if (ctx.jobType === 'syllabus') {
      zodSchemas.SyllabusSchema.parse(parsed);
    } else if (ctx.jobType === 'chapters') {
      zodSchemas.ChaptersArraySchema.parse(parsed);
    } else if (ctx.jobType === 'assemble') {
      zodSchemas.AssembleSchema.parse(parsed);
    } else {
      // Fallback to legacy Ajv validators for older flows
      if (ctx.jobType === 'notes') {
        const ok = validateLegacyNotes(parsed);
        if (!ok) throw new SchemaInvalidError('notes_schema_invalid', validateLegacyNotes.errors);
      } else if (
        ctx.jobType === 'questions' ||
        ctx.jobType === 'tests' ||
        ctx.jobType === 'assemble'
      ) {
        const ok = validateLegacyQuestions(parsed);
        if (!ok)
          throw new SchemaInvalidError('questions_schema_invalid', validateLegacyQuestions.errors);
      } else {
        throw new SchemaInvalidError('jobtype_unknown');
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
        });
      }
      throw new SchemaInvalidError('zod_schema_invalid', zErr.errors);
    }
    throw zErr;
  }

  // Placeholder detection
  const placeholder = scanForPlaceholders(parsed);
  if (placeholder)
    throw new PlaceholderContentError('PLACEHOLDER_CONTENT_DETECTED', { snippet: placeholder });

  // Semantic checks
  if (ctx.jobType === 'notes') {
    if (Array.isArray(parsed.sections)) {
      // ---- VidyaNotesSchema quality gates ----
      const sections = parsed.sections as Array<{
        type: string;
        content: string;
        blackboardNotes?: string[];
      }>;

      // Section count floor: must match the prompt's per-difficulty target.
      // Advanced (grade 11-12) requires 9; foundation/standard requires 7.
      const minSections = ctx.difficultyLevel === 'advanced' ? 9 : 7;
      if (sections.length < minSections) {
        throw new SemanticWeaknessError('notes_too_few_sections', {
          got: sections.length,
          min: minSections,
        });
      }

      // Total content volume check (conservative floor)
      const totalText = sections.map((s) => s.content ?? '').join(' ');
      if (totalText.trim().length < 600) throw new SemanticWeaknessError('notes_too_short');

      // Required section types
      const sectionTypes = sections.map((s) => s.type);
      for (const required of ['hook', 'concept', 'worked_example', 'summary']) {
        if (!sectionTypes.includes(required)) {
          throw new SemanticWeaknessError('notes_missing_required_section', { missing: required });
        }
      }

      // Minimum 2 worked examples
      if (sectionTypes.filter((t) => t === 'worked_example').length < 2) {
        throw new SemanticWeaknessError('notes_too_few_examples');
      }

      // bridgeToNext must be present and non-empty (short sentence acceptable)
      if (!parsed.bridgeToNext || String(parsed.bridgeToNext).trim().length < 20) {
        throw new SemanticWeaknessError('notes_missing_bridge');
      }

      // Per-section quality checks mandated by the prompt contract
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i] as any;
        const content = String(s.content ?? '').trim();
        const wordCount = content.length === 0 ? 0 : content.split(/\s+/).filter(Boolean).length;

        // Every section must have at least one blackboard note
        if (!Array.isArray(s.blackboardNotes) || s.blackboardNotes.length === 0) {
          throw new SemanticWeaknessError('missing_blackboard_notes', {
            sectionIndex: i,
            sectionType: s.type,
          });
        }

        // Content must be teacher-voice prose of reasonable length (>= 80 words)
        if (wordCount < 80) {
          throw new SemanticWeaknessError('section_too_short', {
            sectionIndex: i,
            sectionType: s.type,
            words: wordCount,
          });
        }

        // Worked example sections require exampleSteps
        if (s.type === 'worked_example') {
          if (!Array.isArray(s.exampleSteps) || s.exampleSteps.length === 0) {
            throw new SemanticWeaknessError('worked_example_missing_steps', { sectionIndex: i });
          }
          for (let si = 0; si < s.exampleSteps.length; si++) {
            const step = s.exampleSteps[si];
            if (!step || !String(step.expression || '').trim()) {
              throw new SemanticWeaknessError('example_step_missing_expression', {
                sectionIndex: i,
                stepIndex: si,
              });
            }
            if (!step || !String(step.teacherComment || '').trim()) {
              throw new SemanticWeaknessError('example_step_missing_teacher_comment', {
                sectionIndex: i,
                stepIndex: si,
              });
            }
          }
        }

        // Concept check sections must include a conceptCheck object with question/hint/answer
        if (s.type === 'concept_check') {
          const cc = s.conceptCheck;
          if (
            !cc ||
            !String(cc.question || '').trim() ||
            !String(cc.hint || '').trim() ||
            !String(cc.answer || '').trim()
          ) {
            throw new SemanticWeaknessError('concept_check_missing', { sectionIndex: i });
          }
        }
      }

      // Key concepts and exam tips quality gates
      if (!Array.isArray(parsed.keyConcepts) || parsed.keyConcepts.length < 2) {
        throw new SemanticWeaknessError('too_few_key_concepts');
      }
      if (!Array.isArray(parsed.examTips) || parsed.examTips.length < 3) {
        throw new SemanticWeaknessError('too_few_exam_tips');
      }
    } else {
      // ---- Legacy flat NoteSchema semantic checks ----
      let notesText = '';
      if (typeof parsed.notes === 'string') notesText += ` ${parsed.notes}`;
      if (typeof parsed.explanation === 'string') notesText += ` ${parsed.explanation}`;
      if (typeof parsed.concept === 'string') notesText += ` ${parsed.concept}`;
      if (typeof parsed.example === 'string') notesText += ` ${parsed.example}`;
      if (Array.isArray(parsed.keyPoints)) notesText += ` ${parsed.keyPoints.join(' ')}`;
      if (Array.isArray(parsed.commonMistakes)) notesText += ` ${parsed.commonMistakes.join(' ')}`;

      // 600 chars is a conservative floor -- genuine classroom notes easily exceed this.
      if (notesText.trim().length < 600) throw new SemanticWeaknessError('notes_too_short');
    }
  }

  if (ctx.jobType === 'questions' || ctx.jobType === 'tests' || ctx.jobType === 'assemble') {
    const qs = parsed.questions || [];
    if (!Array.isArray(qs) || qs.length === 0) throw new SemanticWeaknessError('no_questions');
    for (const q of qs) {
      const expl = q.explanation ? String(q.explanation).trim() : '';
      if (expl && expl !== 'Explanation not provided.' && expl.length < 20) {
        throw new SemanticWeaknessError('shallow_question_explanation', {
          question: q.question,
          explanationLength: expl.length,
        });
      }
    }
    // difficulty alignment (case-insensitive)
    if (
      ctx.difficulty &&
      parsed.difficulty &&
      ctx.difficulty.toLowerCase() !== String(parsed.difficulty).toLowerCase()
    ) {
      throw new ContextMismatchError('difficulty_mismatch', {
        expected: ctx.difficulty,
        got: parsed.difficulty,
      });
    }
  }

  // Context validation: language check
  if (ctx.language) {
    const langField = parsed.language || parsed.lang || null;
    if (langField && String(langField).toLowerCase() !== String(ctx.language).toLowerCase()) {
      throw new ContextMismatchError('language_mismatch', {
        expected: ctx.language,
        got: langField,
      });
    }
  }

  // If all checks pass, return true
  return true;
}

const aiOutputValidator = { validateOrThrow };
export default aiOutputValidator;
