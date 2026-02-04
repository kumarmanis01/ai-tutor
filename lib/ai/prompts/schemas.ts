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
  /** Follow-up question to check understanding */
  readonly followUpQuestion: string;
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
