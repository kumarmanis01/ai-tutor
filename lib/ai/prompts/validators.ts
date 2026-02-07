/**
 * FILE OBJECTIVE:
 * - JSON validators for LLM output schemas.
 * - Ensures responses match expected contracts before UI rendering.
 * - Provides detailed error messages for debugging.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/validators.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created JSON validators for schema-first prompt architecture
 */

import type {
  ValidationResult,
  NotesOutputSchema,
  PracticeOutputSchema,
  DoubtsOutputSchema,
  Difficulty,
  QuestionType,
  ConfidenceLevel,
} from './schemas';

// ============================================================================
// PARSING UTILITIES
// ============================================================================

/**
 * Safely parse JSON from LLM response
 * Handles common LLM quirks like markdown fences
 */
export function safeParseLLMJson<T>(rawResponse: string): ValidationResult<T> {
  // Step 1: Clean up common LLM output issues
  let cleaned = rawResponse.trim();
  
  // Remove markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
  
  // Remove any leading/trailing text before/after JSON
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    return {
      valid: false,
      data: null,
      errors: ['Response does not contain valid JSON object'],
    };
  }
  
  cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  
  // Step 2: Parse JSON
  try {
    const parsed = JSON.parse(cleaned) as T;
    return { valid: true, data: parsed, errors: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown parse error';
    return {
      valid: false,
      data: null,
      errors: [`JSON parse error: ${message}`],
    };
  }
}

// ============================================================================
// NOTES VALIDATION
// ============================================================================

/**
 * Validate ExplanationSection structure
 */
function validateExplanationSection(section: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `coreExplanation[${index}]`;
  
  if (!section || typeof section !== 'object') {
    return [`${prefix}: must be an object`];
  }
  
  const s = section as Record<string, unknown>;
  
  if (typeof s.heading !== 'string' || s.heading.length === 0) {
    errors.push(`${prefix}.heading: must be a non-empty string`);
  }
  if (typeof s.content !== 'string' || s.content.length === 0) {
    errors.push(`${prefix}.content: must be a non-empty string`);
  }
  
  return errors;
}

/**
 * Validate WorkedExample structure
 */
function validateWorkedExample(example: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `workedExamples[${index}]`;
  
  if (!example || typeof example !== 'object') {
    return [`${prefix}: must be an object`];
  }
  
  const e = example as Record<string, unknown>;
  
  if (typeof e.question !== 'string' || e.question.length === 0) {
    errors.push(`${prefix}.question: must be a non-empty string`);
  }
  if (typeof e.explanation !== 'string' || e.explanation.length === 0) {
    errors.push(`${prefix}.explanation: must be a non-empty string`);
  }
  
  return errors;
}

/**
 * Validate NotesOutputSchema
 */
export function validateNotesOutput(data: unknown): ValidationResult<NotesOutputSchema> {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, data: null, errors: ['Response must be an object'] };
  }
  
  const obj = data as Record<string, unknown>;
  
  // Required string field
  if (typeof obj.title !== 'string' || obj.title.length === 0) {
    errors.push('title: must be a non-empty string');
  }
  
  // Required array fields
  if (!Array.isArray(obj.learningObjectives)) {
    errors.push('learningObjectives: must be an array');
  } else if (obj.learningObjectives.length === 0) {
    errors.push('learningObjectives: must contain at least one item');
  } else if (!obj.learningObjectives.every((item) => typeof item === 'string')) {
    errors.push('learningObjectives: all items must be strings');
  }
  
  if (!Array.isArray(obj.coreExplanation)) {
    errors.push('coreExplanation: must be an array');
  } else if (obj.coreExplanation.length === 0) {
    errors.push('coreExplanation: must contain at least one section');
  } else {
    obj.coreExplanation.forEach((section, i) => {
      errors.push(...validateExplanationSection(section, i));
    });
  }
  
  if (!Array.isArray(obj.workedExamples)) {
    errors.push('workedExamples: must be an array');
  } else {
    obj.workedExamples.forEach((example, i) => {
      errors.push(...validateWorkedExample(example, i));
    });
  }
  
  if (!Array.isArray(obj.keyTakeaways)) {
    errors.push('keyTakeaways: must be an array');
  } else if (!obj.keyTakeaways.every((item) => typeof item === 'string')) {
    errors.push('keyTakeaways: all items must be strings');
  }
  
  if (!Array.isArray(obj.commonMistakes)) {
    errors.push('commonMistakes: must be an array');
  } else if (!obj.commonMistakes.every((item) => typeof item === 'string')) {
    errors.push('commonMistakes: all items must be strings');
  }
  
  if (errors.length > 0) {
    return { valid: false, data: null, errors };
  }
  
  return { valid: true, data: obj as unknown as NotesOutputSchema, errors: [] };
}

// ============================================================================
// PRACTICE VALIDATION
// ============================================================================

const VALID_QUESTION_TYPES: QuestionType[] = ['mcq', 'short_answer', 'true_false', 'fill_blank'];
const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Validate GeneratedQuestion structure
 */
function validateQuestion(question: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `questions[${index}]`;
  
  if (!question || typeof question !== 'object') {
    return [`${prefix}: must be an object`];
  }
  
  const q = question as Record<string, unknown>;
  
  if (typeof q.id !== 'string' || q.id.length === 0) {
    errors.push(`${prefix}.id: must be a non-empty string`);
  }
  
  if (typeof q.type !== 'string' || !VALID_QUESTION_TYPES.includes(q.type as QuestionType)) {
    errors.push(`${prefix}.type: must be one of ${VALID_QUESTION_TYPES.join(', ')}`);
  }
  
  if (typeof q.question !== 'string' || q.question.length === 0) {
    errors.push(`${prefix}.question: must be a non-empty string`);
  }
  
  // Options validation depends on question type
  const qType = q.type as QuestionType;
  if (qType === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push(`${prefix}.options: MCQ must have exactly 4 options`);
    } else if (!q.options.every((opt) => typeof opt === 'string')) {
      errors.push(`${prefix}.options: all options must be strings`);
    }
  } else if (qType === 'true_false') {
    if (!Array.isArray(q.options) || q.options.length !== 2) {
      errors.push(`${prefix}.options: true_false must have exactly 2 options`);
    }
  } else {
    // short_answer and fill_blank should have null options
    if (q.options !== null && q.options !== undefined) {
      // Allow but don't require null
    }
  }
  
  if (typeof q.correctAnswer !== 'string' || q.correctAnswer.length === 0) {
    errors.push(`${prefix}.correctAnswer: must be a non-empty string`);
  }
  
  // For MCQ, verify correctAnswer matches one of the options
  if (qType === 'mcq' && Array.isArray(q.options)) {
    if (!q.options.includes(q.correctAnswer)) {
      errors.push(`${prefix}.correctAnswer: must match one of the options for MCQ`);
    }
  }
  
  if (typeof q.explanation !== 'string' || q.explanation.length === 0) {
    errors.push(`${prefix}.explanation: must be a non-empty string`);
  }
  
  if (typeof q.difficulty !== 'string' || !VALID_DIFFICULTIES.includes(q.difficulty as Difficulty)) {
    errors.push(`${prefix}.difficulty: must be one of ${VALID_DIFFICULTIES.join(', ')}`);
  }
  
  if (typeof q.conceptTested !== 'string' || q.conceptTested.length === 0) {
    errors.push(`${prefix}.conceptTested: must be a non-empty string`);
  }
  
  return errors;
}

/**
 * Validate PracticeOutputSchema
 */
export function validatePracticeOutput(data: unknown): ValidationResult<PracticeOutputSchema> {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, data: null, errors: ['Response must be an object'] };
  }
  
  const obj = data as Record<string, unknown>;
  
  if (!Array.isArray(obj.questions)) {
    return { valid: false, data: null, errors: ['questions: must be an array'] };
  }
  
  if (obj.questions.length === 0) {
    errors.push('questions: must contain at least one question');
  }
  
  obj.questions.forEach((question, i) => {
    errors.push(...validateQuestion(question, i));
  });
  
  if (errors.length > 0) {
    return { valid: false, data: null, errors };
  }
  
  return { valid: true, data: obj as unknown as PracticeOutputSchema, errors: [] };
}

// ============================================================================
// DOUBTS VALIDATION
// ============================================================================

const VALID_CONFIDENCE_LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low'];

/**
 * Validate DoubtsOutputSchema
 */
export function validateDoubtsOutput(data: unknown): ValidationResult<DoubtsOutputSchema> {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, data: null, errors: ['Response must be an object'] };
  }
  
  const obj = data as Record<string, unknown>;
  
  if (typeof obj.response !== 'string' || obj.response.length === 0) {
    errors.push('response: must be a non-empty string');
  }
  
  if (typeof obj.followUpQuestion !== 'string' || obj.followUpQuestion.length === 0) {
    errors.push('followUpQuestion: must be a non-empty string');
  }
  
  if (
    typeof obj.confidenceLevel !== 'string' ||
    !VALID_CONFIDENCE_LEVELS.includes(obj.confidenceLevel as ConfidenceLevel)
  ) {
    errors.push(`confidenceLevel: must be one of ${VALID_CONFIDENCE_LEVELS.join(', ')}`);
  }
  
  if (errors.length > 0) {
    return { valid: false, data: null, errors };
  }
  
  return { valid: true, data: obj as unknown as DoubtsOutputSchema, errors: [] };
}

// ============================================================================
// UNIFIED VALIDATOR
// ============================================================================

export type PromptType = 'notes' | 'practice' | 'doubts';

/**
 * Validate LLM response based on prompt type
 */
export function validateLLMResponse<T>(
  rawResponse: string,
  promptType: PromptType
): ValidationResult<T> {
  // First, parse the JSON
  const parseResult = safeParseLLMJson<unknown>(rawResponse);
  
  if (!parseResult.valid || !parseResult.data) {
    return {
      valid: false,
      data: null,
      errors: parseResult.errors,
    };
  }
  
  // Then, validate based on type
  switch (promptType) {
    case 'notes':
      return validateNotesOutput(parseResult.data) as ValidationResult<T>;
    case 'practice':
      return validatePracticeOutput(parseResult.data) as ValidationResult<T>;
    case 'doubts':
      return validateDoubtsOutput(parseResult.data) as ValidationResult<T>;
    default:
      return {
        valid: false,
        data: null,
        errors: [`Unknown prompt type: ${promptType}`],
      };
  }
}
