import { z } from 'zod'

// ---------------------------------------------------------------------------
// Old flat schema -- kept for BilingualNotesSchema backward compat.
// New generations use VidyaNotesSchema below.
// ---------------------------------------------------------------------------
export const NoteSchema = z.object({
  title: z.string(),
  concept: z.string(),
  explanation: z.string(),
  example: z.string(),
  keyPoints: z.array(z.string()).min(4).max(7),
  commonMistakes: z.array(z.string()).min(2).max(4)
})

// ---------------------------------------------------------------------------
// Rich classroom-quality schema (Vidya notes v2)
// ---------------------------------------------------------------------------
const ExampleStepSchema = z.object({
  stepNumber: z.number(),
  expression: z.string(),
  teacherComment: z.string(),
  isCommonMistakePoint: z.boolean(),
})

const ConceptCheckSchema = z.object({
  question: z.string(),
  hint: z.string(),
  answer: z.string(),
})

export const NoteSectionSchema = z.object({
  type: z.enum(['hook', 'concept', 'worked_example', 'concept_check', 'common_mistake', 'memory_aid', 'summary']),
  title: z.string(),
  content: z.string().min(50),
  blackboardNotes: z.array(z.string()),
  visualHint: z.string().nullable(),
  formulaLatex: z.string().nullable(),
  exampleSteps: z.array(ExampleStepSchema).nullable(),
  conceptCheck: ConceptCheckSchema.nullable(),
})

const KeyConceptSchema = z.object({
  term: z.string(),
  definition: z.string(),
  formula: z.string().nullable(),
})

const NoteMetadataSchema = z.object({
  board: z.string(),
  grade: z.number(),
  subject: z.string(),
  chapter: z.string(),
  topic: z.string(),
  estimatedReadingMinutes: z.number(),
  difficultyLevel: z.string(),
  conceptsIntroduced: z.array(z.string()),
})

export const VidyaNotesSchema = z.object({
  metadata: NoteMetadataSchema,
  // Minimum 7 matches the prompt's floor for foundation/standard difficulty (grade <= 10).
  // Advanced (grade 11-12) requires 9 -- enforced semantically in aiOutputValidator.
  sections: z.array(NoteSectionSchema).min(7),
  keyConcepts: z.array(KeyConceptSchema).min(1),
  examTips: z.array(z.string()).min(1),
  bridgeToNext: z.string().min(10),
})

export type VidyaNotes = z.infer<typeof VidyaNotesSchema>
export type NoteSection = z.infer<typeof NoteSectionSchema>

// ---------------------------------------------------------------------------
// Grammar notes schemas (language subjects only)
// ---------------------------------------------------------------------------

export const GrammarExampleSchema = z.object({
  level: z.enum(['isolated', 'in_sentence', 'exam_style', 'chapter_extracted']),
  incorrect: z.string().optional(),
  correct: z.string(),
  teacherComment: z.string(),
})

export const CommonErrorSchema = z.object({
  errorDescription: z.string(),
  wrongExample: z.string(),
  correctExample: z.string(),
  whyWrong: z.string(),
})

export const GrammarNotesBlockSchema = z.object({
  domain: z.string(),
  title: z.string(),
  chapterAnchor: z.string().min(10),
  formalRule: z.string().min(20),
  simpleRule: z.string().min(20),
  structurePattern: z.string(),
  examples: z.array(GrammarExampleSchema).min(3),
  commonErrors: z.array(CommonErrorSchema).min(2),
  examTips: z.array(z.string()).min(2),
  languageSpecificNuances: z.array(z.string()).optional(),
  blackboardNotes: z.array(z.string()).min(1),
})

export const LanguageVidyaNotesSchema = VidyaNotesSchema.extend({
  grammarNotes: GrammarNotesBlockSchema,
})

export type GrammarExample = z.infer<typeof GrammarExampleSchema>
export type CommonError = z.infer<typeof CommonErrorSchema>
export type GrammarNotesBlock = z.infer<typeof GrammarNotesBlockSchema>
export type LanguageVidyaNotes = z.infer<typeof LanguageVidyaNotesSchema>

// ---------------------------------------------------------------------------
// Grammar question schemas (language subjects only)
// ---------------------------------------------------------------------------

export const GRAMMAR_QUESTION_TYPES = [
  'identify',
  'transform',
  'fill_in_blanks',
  'error_correction',
  'match_the_column',
  'rewrite_as_directed',
  'sentence_formation',
  'chapter_context',
] as const

export type GrammarQuestionType = typeof GRAMMAR_QUESTION_TYPES[number]

export const GrammarQuestionSchema = z.object({
  question: z.string(),
  type: z.enum(GRAMMAR_QUESTION_TYPES),
  grammarDomain: z.string(),
  options: z.array(z.string()).min(3).max(5).optional(),
  answer: z.any(),
  explanation: z.string(),
  chapterLinked: z.boolean(),
  markingHint: z.string(),
  difficulty: z
    .string()
    .transform(v => v.toLowerCase())
    .pipe(z.enum(['easy', 'medium', 'hard']))
    .optional(),
})

export type GrammarQuestion = z.infer<typeof GrammarQuestionSchema>

export const QuestionsItemSchema = z.object({
  question: z.string(),
  type: z.string(),
  options: z.array(z.string()).min(3).max(5).optional(),
  answer: z.any(),
  explanation: z.string().optional(),
  difficulty: z.string().transform(v => v.toLowerCase()).pipe(z.enum(['easy', 'medium', 'hard'])).optional(),
  solutionSteps: z.array(z.string()).optional()
})

export const QuestionsSchema = z.object({
  questions: z.array(QuestionsItemSchema).min(1)
})

export const LanguageQuestionsSchema = z.object({
  comprehensionQuestions: z.array(QuestionsItemSchema).optional(),
  grammarQuestions: z.array(GrammarQuestionSchema).min(5),
})

export type LanguageQuestions = z.infer<typeof LanguageQuestionsSchema>

export const BilingualNotesSchema = z.object({
  en: NoteSchema.optional(),
  hi: NoteSchema.optional()
})

export const TopicSchema = z.object({ title: z.string(), order: z.number() })
export const ChapterSchema = z.object({ title: z.string(), order: z.number(), topics: z.array(TopicSchema) })
export const SyllabusSchema = z.object({ chapters: z.array(ChapterSchema) })

export const ChaptersArraySchema = z.array(z.object({
  title: z.string(),
  order: z.number(),
  summary: z.string(),
  topics: z.array(TopicSchema).min(3).max(8)
}))

export const AssembleSchema = z.object({
  topic: z.string(),
  grade: z.number(),
  version: z.string(),
  content: z.any(),
  metadata: z.object({ createdBy: z.string().nullable(), createdAt: z.string() })
})

export type Note = z.infer<typeof NoteSchema>
export type Questions = z.infer<typeof QuestionsSchema>

const PromptSchemas = {
  NoteSchema,
  VidyaNotesSchema,
  LanguageVidyaNotesSchema,
  QuestionsSchema,
  LanguageQuestionsSchema,
  BilingualNotesSchema,
  SyllabusSchema,
  ChaptersArraySchema,
  AssembleSchema,
}

export default PromptSchemas
/**
 * FILE OBJECTIVE:
 * - TypeScript contracts for schema-first prompt architecture.
 * - Defines input contracts (from backend) and output schemas (from LLM).
 * - These are the "API contracts" for AI interactions - non-negotiable structure.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/schemas.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created schema-first prompt contracts for K-12 AI tutor
 */

// ============================================================================
// SHARED TYPES
// ============================================================================

/** Supported education boards */
export type Board = 'CBSE' | 'ICSE' | 'STATE' | 'IB' | 'IGCSE';

/** Supported languages */
export type Language = 'English' | 'Hindi' | 'Hinglish';

/** Grade levels (K-12) */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Difficulty levels for questions */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Question types supported */
export type QuestionType = 'mcq' | 'short_answer' | 'true_false' | 'fill_blank';

/** Explanation depth levels */
export type ExplanationLevel = 'simple' | 'conceptual' | 'detailed';

/** Content length preferences */
export type ContentLength = 'short' | 'medium' | 'long';

/** Student intent classification for doubts */
export type StudentIntent =
  | 'conceptual_clarity'
  | 'example_needed'
  | 'step_by_step'
  | 'comparison'
  | 'real_world_application'
  | 'revision'
  | 'give_final_answer'    // Flagged for rewrite
  | 'solve_homework'       // Flagged for rewrite
  | 'copy_paste';          // Flagged for rewrite

/** Confidence levels for AI responses */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ============================================================================
// BASE STUDENT CONTEXT (injected into every request)
// ============================================================================

/**
 * Core student context - minimum required for any AI interaction
 */
export interface StudentContext {
  /** Student's grade level */
  readonly grade: Grade;
  /** Education board */
  readonly board: Board;
  /** Preferred language */
  readonly language: Language;
  /** Current subject */
  readonly subject: string;
}

/**
 * Extended topic context for content generation
 */
export interface TopicContext extends StudentContext {
  /** Chapter name */
  readonly chapter: string;
  /** Specific topic within chapter */
  readonly topic: string;
  /** Optional: Database topic ID for logging integration */
  readonly topicId?: string;
}

// ============================================================================
// 1️⃣ NOTES GENERATION - INPUT/OUTPUT CONTRACTS
// ============================================================================

/**
 * INPUT CONTRACT: Notes Generation Request
 * Sent from backend to prompt builder
 */
export interface NotesInputContract extends TopicContext {
  /** Depth of explanation */
  readonly explanationLevel: ExplanationLevel;
  /** Desired content length */
  readonly preferredLength: ContentLength;
}

/**
 * Section within core explanation
 */
export interface ExplanationSection {
  /** Section heading */
  readonly heading: string;
  /** Section content (markdown supported) */
  readonly content: string;
}

/**
 * Worked example with step-by-step explanation
 */
export interface WorkedExample {
  /** The question/problem */
  readonly question: string;
  /** Step-by-step explanation */
  readonly explanation: string;
}

/**
 * OUTPUT SCHEMA: Notes Generation Response
 * Expected JSON structure from LLM
 */
export interface NotesOutputSchema {
  /** Note title */
  readonly title: string;
  /** What student will learn */
  readonly learningObjectives: string[];
  /** Main explanation sections */
  readonly coreExplanation: ExplanationSection[];
  /** Worked examples with explanations */
  readonly workedExamples: WorkedExample[];
  /** Key points to remember */
  readonly keyTakeaways: string[];
  /** Common mistakes to avoid */
  readonly commonMistakes: string[];
}

// ============================================================================
// 2️⃣ PRACTICE / QUESTIONS - INPUT/OUTPUT CONTRACTS
// ============================================================================

/**
 * INPUT CONTRACT: Practice Questions Request
 * Sent from backend to prompt builder
 */
export interface PracticeInputContract extends TopicContext {
  /** Difficulty level */
  readonly difficulty: Difficulty;
  /** Number of questions to generate */
  readonly questionCount: number;
  /** Optional: specific question types to include */
  readonly questionTypes?: QuestionType[];
}

/**
 * Single question structure
 */
export interface GeneratedQuestion {
  /** Unique identifier */
  readonly id: string;
  /** Question type */
  readonly type: QuestionType;
  /** The question text */
  readonly question: string;
  /** Options for MCQ (null for other types) */
  readonly options: string[] | null;
  /** Correct answer */
  readonly correctAnswer: string;
  /** Explanation for the answer (always required for learning) */
  readonly explanation: string;
  /** Question difficulty */
  readonly difficulty: Difficulty;
  /** Concept being tested */
  readonly conceptTested: string;
}

/**
 * OUTPUT SCHEMA: Practice Questions Response
 * Expected JSON structure from LLM
 */
export interface PracticeOutputSchema {
  /** Array of generated questions */
  readonly questions: GeneratedQuestion[];
}

// ============================================================================
// 3️⃣ DOUBTS / AI CHAT - INPUT/OUTPUT CONTRACTS
// ============================================================================

/**
 * INPUT CONTRACT: Doubts/Chat Request
 * Sent from backend to prompt builder
 */
export interface DoubtsInputContract extends TopicContext {
  /** The student's question */
  readonly studentQuestion: string;
  /** Classified intent (may be rewritten internally) */
  readonly studentIntent: StudentIntent;
  /** Optional: conversation history for context */
  readonly conversationHistory?: ConversationMessage[];
}

/**
 * Single message in conversation history
 */
export interface ConversationMessage {
  /** Message role */
  readonly role: 'student' | 'tutor';
  /** Message content */
  readonly content: string;
  /** Timestamp */
  readonly timestamp: string;
}

/**
 * OUTPUT SCHEMA: Doubts/Chat Response
 * Expected JSON structure from LLM
 */
export interface DoubtsOutputSchema {
  /** The AI tutor's response */
  readonly response: string;
  /** Follow-up questions to check understanding */
  readonly followUpQuestions: readonly string[];
  /** Internal confidence level (NOT shown to student) */
  readonly confidenceLevel: ConfidenceLevel;
}

// ============================================================================
// PROMPT METADATA (for tracking and analytics)
// ============================================================================

/**
 * Metadata attached to every prompt request
 */
export interface PromptMetadata {
  /** Unique request ID for tracing */
  readonly requestId: string;
  /** Prompt type */
  readonly promptType: 'notes' | 'practice' | 'doubts';
  /** Timestamp */
  readonly timestamp: string;
  /** User ID (hashed for privacy) */
  readonly userIdHash: string;
  /** Session ID */
  readonly sessionId: string;
}

// ============================================================================
// VALIDATION RESULT TYPE
// ============================================================================

/**
 * Result of JSON schema validation
 */
export interface ValidationResult<T> {
  /** Whether validation passed */
  readonly valid: boolean;
  /** Parsed data if valid */
  readonly data: T | null;
  /** Validation errors if invalid */
  readonly errors: string[];
}

// ============================================================================
// DIFFICULTY CALIBRATION REFERENCE (for prompt building)
// ============================================================================

/**
 * Difficulty characteristics for question generation
 * Used in prompt construction to guide LLM
 */
export const DIFFICULTY_CALIBRATION: Record<Difficulty, string> = {
  easy: 'Definition-based, direct recall, single-step thinking',
  medium: 'Requires reasoning, may include examples, two-step thinking',
  hard: 'Application-based, requires "why" understanding, multi-step thinking',
} as const;

// ============================================================================
// INTENT REWRITE MAPPING (Anti-abuse guardrail)
// ============================================================================

/**
 * Intents that should be silently rewritten for educational benefit
 * Students asking for direct answers still get conceptual explanations
 */
export const INTENT_REWRITES: Partial<Record<StudentIntent, StudentIntent>> = {
  give_final_answer: 'conceptual_clarity',
  solve_homework: 'step_by_step',
  copy_paste: 'conceptual_clarity',
} as const;

/**
 * Check if an intent should be rewritten
 */
export function shouldRewriteIntent(intent: StudentIntent): boolean {
  return intent in INTENT_REWRITES;
}

/**
 * Get the rewritten intent (or original if no rewrite needed)
 */
export function getEffectiveIntent(intent: StudentIntent): StudentIntent {
  return INTENT_REWRITES[intent] ?? intent;
}
