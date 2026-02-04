/**
 * FILE OBJECTIVE:
 * - Build exact OpenAI API payloads for Notes, Practice, and Doubts.
 * - Enforce schema-first outputs using tool definitions.
 * - Grade-, board-, subject-, and difficulty-aware prompts.
 * - Prevent hallucinations and shortcut answers via strict system prompts.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/ai/openai/payloadBuilder.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created OpenAI payload builder for education use cases
 */

import type {
  EducationContext,
  OpenAIToolDefinition,
  ToolSchemaType,
} from './schemas';
import {
  NOTES_OUTPUT_SCHEMA,
  PRACTICE_QUESTION_SCHEMA,
  DOUBT_RESOLUTION_SCHEMA,
  QUIZ_GENERATION_SCHEMA,
} from './schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * OpenAI message role types
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'developer';

/**
 * OpenAI message structure
 */
export interface OpenAIMessage {
  readonly role: MessageRole;
  readonly content: string;
}

/**
 * Complete OpenAI API payload
 */
export interface OpenAIPayload {
  readonly model: string;
  readonly messages: OpenAIMessage[];
  readonly tools: OpenAIToolDefinition[];
  readonly tool_choice: {
    readonly type: 'function';
    readonly function: { readonly name: string };
  };
  readonly temperature: number;
  readonly max_tokens: number;
  readonly response_format?: { readonly type: 'json_object' };
}

/**
 * Notes generation request
 */
export interface NotesRequest {
  readonly context: EducationContext;
  readonly topic: string;
  readonly subtopics?: string[];
  readonly focusAreas?: string[];
  readonly maxReadTimeMinutes?: number;
}

/**
 * Practice question request
 */
export interface PracticeRequest {
  readonly context: EducationContext;
  readonly topic: string;
  readonly questionType: 'MCQ' | 'FILL_BLANK' | 'TRUE_FALSE' | 'SHORT_ANSWER';
  readonly count?: number;
  readonly bloomLevel?: 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE';
  readonly previousMistakes?: string[];
}

/**
 * Doubt resolution request
 */
export interface DoubtRequest {
  readonly context: EducationContext;
  readonly studentQuestion: string;
  readonly conversationHistory?: Array<{ role: 'student' | 'tutor'; message: string }>;
  readonly relatedNotes?: string;
}

/**
 * Quiz generation request
 */
export interface QuizRequest {
  readonly context: EducationContext;
  readonly topics: string[];
  readonly questionCount: number;
  readonly timeMinutes: number;
  readonly difficultyMix?: { easy: number; medium: number; hard: number };
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

/**
 * Base system prompt with safety rules.
 * 
 * EDUCATION REASONING:
 * - Establishes AI as a teaching assistant, not answer machine
 * - Prevents hallucinations with explicit constraints
 * - Enforces grade-appropriate content
 */
function buildBaseSystemPrompt(context: EducationContext): string {
  const gradeDescriptor = getGradeDescriptor(context.grade);
  
  return `You are an expert educational content creator for ${gradeDescriptor} students in India.

CRITICAL RULES (NEVER VIOLATE):
1. ACCURACY: Only provide factually correct information aligned with ${context.board} curriculum.
2. NO HALLUCINATION: If unsure about any fact, mark confidence as low. Do not make up information.
3. GRADE-APPROPRIATE: Use vocabulary and complexity suitable for Grade ${context.grade}.
4. NO SHORTCUTS: Never give direct answers without explanation. Always teach the concept.
5. STRUCTURED OUTPUT: You MUST use the provided tool schema. No free-text responses allowed.
6. SAFETY: Never include content that is inappropriate for children.

CONTEXT:
- Board: ${context.board}
- Subject: ${context.subject}
- Chapter: ${context.chapter}
- Difficulty: ${context.difficulty}
- Language: ${context.language}

YOUR ROLE: Help students understand concepts deeply. You are a patient tutor, not an answer key.`;
}

/**
 * System prompt specific to notes generation
 */
function buildNotesSystemPrompt(context: EducationContext): string {
  return `${buildBaseSystemPrompt(context)}

NOTES GENERATION RULES:
1. Structure content with clear headings and bullet points
2. Include real-world examples relevant to Indian students
3. Keep sentences short for Grade ${context.grade} reading level
4. Mark key terms that students should memorize
5. Include common mistakes students make
6. Estimate realistic reading time based on grade level

QUALITY CHECKLIST:
- [ ] All facts are verifiable from ${context.board} textbooks
- [ ] Examples are age-appropriate and culturally relevant
- [ ] Vocabulary matches Grade ${context.grade} level
- [ ] No content exceeds the chapter's scope`;
}

/**
 * System prompt specific to practice questions
 */
function buildPracticeSystemPrompt(context: EducationContext): string {
  return `${buildBaseSystemPrompt(context)}

PRACTICE QUESTION RULES:
1. Questions must test understanding, not just memorization
2. MCQ distractors must be plausible but clearly incorrect
3. Explanations must teach WHY, not just state the answer
4. Difficulty must match the requested level: ${context.difficulty}
5. Include hints that guide thinking without giving away answers

QUESTION QUALITY:
- Easy: Direct recall or single-step application
- Medium: Multi-step reasoning or comparison
- Hard: Analysis, synthesis, or novel application
- Exam: Match actual ${context.board} exam patterns

ANTI-CHEATING:
- Vary question phrasing so students can't memorize answers
- Test the same concept from different angles`;
}

/**
 * System prompt specific to doubt resolution
 */
function buildDoubtSystemPrompt(context: EducationContext): string {
  return `${buildBaseSystemPrompt(context)}

DOUBT RESOLUTION RULES:
1. FIRST: Validate if this is a genuine learning question
2. DETECT: Homework dumps (full problems with no attempt shown)
3. TEACH: Guide students to the answer, don't just provide it
4. SOCRATIC: Ask follow-up questions to deepen understanding
5. EMPATHY: Acknowledge frustration, encourage persistence

RESPONSE PATTERN:
1. Acknowledge the question warmly
2. Clarify what you understood they're asking
3. Explain the concept step-by-step
4. Provide an analogy or real-world connection
5. Check understanding with a follow-up question

RED FLAGS (REJECT OR REDIRECT):
- "Solve this for me" without showing work
- Multiple full questions pasted at once
- Questions clearly from an ongoing exam
- Off-syllabus or inappropriate content`;
}

/**
 * System prompt for quiz generation
 */
function buildQuizSystemPrompt(context: EducationContext): string {
  return `${buildBaseSystemPrompt(context)}

QUIZ GENERATION RULES:
1. Balance difficulty according to requested distribution
2. Cover all requested topics proportionally
3. Vary question types if allowed
4. Include clear instructions for students
5. Time limit should be realistic for Grade ${context.grade}

QUESTION SEQUENCING:
- Start with easier questions to build confidence
- Place harder questions in the middle
- End with medium-difficulty for positive finish

FAIRNESS:
- No trick questions that confuse rather than test
- All necessary information must be in the question
- Options should be similar in length and complexity`;
}

// ============================================================================
// PAYLOAD BUILDERS
// ============================================================================

/**
 * Build payload for generating educational notes.
 * 
 * @param request - Notes generation request
 * @returns Complete OpenAI API payload
 * 
 * @example
 * ```ts
 * const payload = buildNotesPayload({
 *   context: { grade: 5, board: 'CBSE', subject: 'Science', chapter: 'Force', difficulty: 'MEDIUM', language: 'EN' },
 *   topic: 'Types of Forces',
 *   focusAreas: ['Friction', 'Gravity'],
 * });
 * ```
 */
export function buildNotesPayload(request: NotesRequest): OpenAIPayload {
  const { context, topic, subtopics, focusAreas, maxReadTimeMinutes } = request;
  
  // Build user message with specific requirements
  let userMessage = `Generate comprehensive notes on "${topic}" for the chapter "${context.chapter}".`;
  
  if (subtopics && subtopics.length > 0) {
    userMessage += `\n\nCover these subtopics: ${subtopics.join(', ')}`;
  }
  
  if (focusAreas && focusAreas.length > 0) {
    userMessage += `\n\nPay special attention to: ${focusAreas.join(', ')}`;
  }
  
  if (maxReadTimeMinutes) {
    userMessage += `\n\nTarget reading time: ${maxReadTimeMinutes} minutes maximum.`;
  }
  
  userMessage += `\n\nRemember: Content must be appropriate for Grade ${context.grade} ${context.board} curriculum.`;
  
  return {
    model: selectModel(context),
    messages: [
      { role: 'system', content: buildNotesSystemPrompt(context) },
      { role: 'user', content: userMessage },
    ],
    tools: [NOTES_OUTPUT_SCHEMA],
    tool_choice: {
      type: 'function',
      function: { name: 'generate_educational_notes' },
    },
    temperature: getTemperature('NOTES', context.difficulty),
    max_tokens: getMaxTokens('NOTES', context),
  };
}

/**
 * Build payload for generating practice questions.
 * 
 * @param request - Practice question request
 * @returns Complete OpenAI API payload
 */
export function buildPracticePayload(request: PracticeRequest): OpenAIPayload {
  const { context, topic, questionType, count = 1, bloomLevel, previousMistakes } = request;
  
  let userMessage = `Generate ${count} ${questionType} question(s) on "${topic}".`;
  userMessage += `\n\nDifficulty Level: ${context.difficulty}`;
  
  if (bloomLevel) {
    userMessage += `\nBloom's Level: ${bloomLevel}`;
  }
  
  if (previousMistakes && previousMistakes.length > 0) {
    userMessage += `\n\nThe student has previously struggled with:\n- ${previousMistakes.join('\n- ')}`;
    userMessage += `\n\nInclude questions that address these gaps.`;
  }
  
  userMessage += `\n\nEnsure the question tests understanding, not just memorization.`;
  
  return {
    model: selectModel(context),
    messages: [
      { role: 'system', content: buildPracticeSystemPrompt(context) },
      { role: 'user', content: userMessage },
    ],
    tools: [PRACTICE_QUESTION_SCHEMA],
    tool_choice: {
      type: 'function',
      function: { name: 'generate_practice_question' },
    },
    temperature: getTemperature('PRACTICE', context.difficulty),
    max_tokens: getMaxTokens('PRACTICE', context),
  };
}

/**
 * Build payload for resolving student doubts.
 * 
 * @param request - Doubt resolution request
 * @returns Complete OpenAI API payload
 */
export function buildDoubtPayload(request: DoubtRequest): OpenAIPayload {
  const { context, studentQuestion, conversationHistory, relatedNotes } = request;
  
  const messages: OpenAIMessage[] = [
    { role: 'system', content: buildDoubtSystemPrompt(context) },
  ];
  
  // Add conversation history if available
  if (conversationHistory && conversationHistory.length > 0) {
    // Developer message provides context about conversation
    messages.push({
      role: 'developer',
      content: `Previous conversation context (for reference, not included in response):\n${
        conversationHistory.map(h => `${h.role}: ${h.message}`).join('\n')
      }`,
    });
  }
  
  // Add related notes as context
  if (relatedNotes) {
    messages.push({
      role: 'developer',
      content: `Related notes the student has access to:\n${relatedNotes}\n\nUse this context to make your explanation consistent.`,
    });
  }
  
  // Add the student's question
  messages.push({
    role: 'user',
    content: studentQuestion,
  });
  
  return {
    model: selectModel(context),
    messages,
    tools: [DOUBT_RESOLUTION_SCHEMA],
    tool_choice: {
      type: 'function',
      function: { name: 'resolve_student_doubt' },
    },
    temperature: getTemperature('DOUBT', context.difficulty),
    max_tokens: getMaxTokens('DOUBT', context),
  };
}

/**
 * Build payload for generating a complete quiz.
 * 
 * @param request - Quiz generation request
 * @returns Complete OpenAI API payload
 */
export function buildQuizPayload(request: QuizRequest): OpenAIPayload {
  const { context, topics, questionCount, timeMinutes, difficultyMix } = request;
  
  let userMessage = `Generate a quiz with ${questionCount} questions.`;
  userMessage += `\n\nTopics to cover: ${topics.join(', ')}`;
  userMessage += `\nTime limit: ${timeMinutes} minutes`;
  
  if (difficultyMix) {
    userMessage += `\n\nDifficulty distribution:`;
    userMessage += `\n- Easy: ${difficultyMix.easy}%`;
    userMessage += `\n- Medium: ${difficultyMix.medium}%`;
    userMessage += `\n- Hard: ${difficultyMix.hard}%`;
  }
  
  userMessage += `\n\nCreate a balanced assessment that tests both recall and application.`;
  
  return {
    model: selectModel(context),
    messages: [
      { role: 'system', content: buildQuizSystemPrompt(context) },
      { role: 'user', content: userMessage },
    ],
    tools: [QUIZ_GENERATION_SCHEMA],
    tool_choice: {
      type: 'function',
      function: { name: 'generate_quiz' },
    },
    temperature: getTemperature('QUIZ', context.difficulty),
    max_tokens: getMaxTokens('QUIZ', context),
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get grade descriptor for prompts
 */
function getGradeDescriptor(grade: number): string {
  if (grade <= 3) return `young learners (Grade ${grade}, ages 6-8)`;
  if (grade <= 7) return `middle school students (Grade ${grade}, ages 9-12)`;
  return `high school students (Grade ${grade}, ages 13-18)`;
}

/**
 * Select appropriate model based on context.
 * 
 * COST REASONING:
 * - Junior grades use smaller models (simpler content)
 * - Senior grades may need larger models for complex topics
 * - Exam difficulty always uses best model
 */
function selectModel(context: EducationContext): string {
  // Default model for most use cases
  const defaultModel = 'gpt-4o-mini';
  const advancedModel = 'gpt-4o';
  
  // Use advanced model for:
  // - Exam-level difficulty
  // - Senior grades with complex subjects
  // - Subjects requiring precise accuracy (Science, Math)
  if (context.difficulty === 'EXAM') {
    return advancedModel;
  }
  
  if (context.grade >= 9 && ['Physics', 'Chemistry', 'Mathematics', 'Biology'].includes(context.subject)) {
    return advancedModel;
  }
  
  return defaultModel;
}

/**
 * Get temperature setting based on content type and difficulty.
 * 
 * REASONING:
 * - Lower temperature = more deterministic, factual responses
 * - Higher temperature = more creative but risky
 * - Educational content should be consistent and accurate
 */
function getTemperature(type: ToolSchemaType | 'QUIZ', difficulty: string): number {
  const baseTemperatures: Record<string, number> = {
    NOTES: 0.3,      // Factual, consistent
    PRACTICE: 0.4,   // Some variety in questions
    DOUBT: 0.5,      // Slightly more adaptive
    QUIZ: 0.3,       // Consistent difficulty
  };
  
  let temp = baseTemperatures[type] ?? 0.4;
  
  // Reduce temperature for exam-level content (maximum precision)
  if (difficulty === 'EXAM') {
    temp = Math.max(0.1, temp - 0.2);
  }
  
  return temp;
}

/**
 * Get max tokens based on content type and grade.
 * 
 * REASONING:
 * - Junior grades need shorter content
 * - Notes need more tokens than single questions
 * - Quiz generation needs most tokens
 */
function getMaxTokens(type: ToolSchemaType | 'QUIZ', context: EducationContext): number {
  const gradeMultiplier = context.grade <= 3 ? 0.7 : context.grade <= 7 ? 0.85 : 1.0;
  
  const baseTokens: Record<string, number> = {
    NOTES: 2000,
    PRACTICE: 800,
    DOUBT: 1200,
    QUIZ: 4000,
  };
  
  return Math.round((baseTokens[type] ?? 1000) * gradeMultiplier);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that a response matches the expected schema.
 * Throws if schema is violated.
 * 
 * @param response - The parsed response from OpenAI
 * @param schemaType - The expected schema type
 * @throws Error if validation fails
 */
export function validateResponse(response: unknown, schemaType: ToolSchemaType): boolean {
  if (!response || typeof response !== 'object') {
    throw new Error(`Invalid response: expected object, got ${typeof response}`);
  }
  
  // Schema-specific validation
  switch (schemaType) {
    case 'NOTES':
      return validateNotesResponse(response);
    case 'PRACTICE':
      return validatePracticeResponse(response);
    case 'DOUBT':
      return validateDoubtResponse(response);
    default:
      throw new Error(`Unknown schema type: ${schemaType}`);
  }
}

function validateNotesResponse(response: unknown): boolean {
  const required = ['topic_title', 'learning_objectives', 'key_concepts', 'explanation', 'remember_points'];
  const obj = response as Record<string, unknown>;
  
  for (const field of required) {
    if (!(field in obj)) {
      throw new Error(`Missing required field in notes response: ${field}`);
    }
  }
  
  // Ensure learning_objectives has at least 2 items
  if (!Array.isArray(obj.learning_objectives) || (obj.learning_objectives as any[]).length < 2) {
    throw new Error('Missing required field in notes response: learning_objectives');
  }

  // Ensure key_concepts is a non-empty array (tests expect empty array to be invalid)
  if (!Array.isArray(obj.key_concepts) || (obj.key_concepts as any[]).length === 0) {
    throw new Error('Missing required field in notes response: key_concepts');
  }
  
  return true;
}

function validatePracticeResponse(response: unknown): boolean {
  const required = ['question_type', 'question_text', 'correct_answer', 'explanation', 'difficulty'];
  const obj = response as Record<string, unknown>;
  
  for (const field of required) {
    if (!(field in obj)) {
      throw new Error(`Missing required field in practice response: ${field}`);
    }
  }
  
  return true;
}

function validateDoubtResponse(response: unknown): boolean {
  const required = ['understood_question', 'doubt_category', 'is_valid_academic_doubt', 'confidence_score'];
  const obj = response as Record<string, unknown>;
  
  for (const field of required) {
    if (!(field in obj)) {
      throw new Error(`Missing required field in doubt response: ${field}`);
    }
  }
  
  // Check confidence threshold
  const confidence = obj['confidence_score'] as number;
  if (typeof confidence === 'number' && confidence < 0.5) {
    throw new Error(`Low confidence response (${confidence}). Fallback required.`);
  }
  
  return true;
}
