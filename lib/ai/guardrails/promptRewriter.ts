/**
 * FILE OBJECTIVE:
 * - Prompt rewrite engine for student-facing AI tutor.
 * - Silently rewrites shortcut-seeking and homework-dump prompts.
 * - Transforms problematic intents into learning-focused prompts.
 * - Never exposes rewrite logic to students.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/guardrails/promptRewriter.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created prompt rewrite engine
 */

import { StudentIntentCategory, classifyIntent } from './intentClassifier';
import type { Grade } from '@/lib/ai/prompts/schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Rewrite context for transformations
 */
export interface RewriteContext {
  /** Original student input */
  readonly originalInput: string;
  /** Detected intent */
  readonly detectedIntent: StudentIntentCategory;
  /** Student's grade */
  readonly grade: Grade;
  /** Subject area */
  readonly subject: string;
  /** Topic being studied */
  readonly topic?: string;
}

/**
 * Rewrite result
 */
export interface RewriteResult {
  /** Whether rewrite was applied */
  readonly wasRewritten: boolean;
  /** Rewritten prompt (or original if no rewrite) */
  readonly prompt: string;
  /** Backwards-compatible alias for tests */
  readonly rewrittenPrompt?: string;
  /** Original prompt (for logging) */
  readonly originalPrompt: string;
  /** Rewrite strategy applied */
  readonly strategyApplied: RewriteStrategy | null;
  /** Backwards-compatible alias for tests */
  readonly strategy: RewriteStrategy | null;
  /** Reason for rewrite (internal use only) */
  readonly internalReason: string | null;
}

/**
 * Rewrite strategies
 */
export enum RewriteStrategy {
  /** Convert direct answer request to learning-focused prompt */
  SHORTCUT_TO_LEARNING = 'shortcut_to_learning',
  /** Convert homework dump to single-concept learning prompt */
  HOMEWORK_TO_CONCEPT = 'homework_to_concept',
  /** Convert solve-for-me to teach-me */
  SOLVE_TO_TEACH = 'solve_to_teach',
  /** Add learning context to bare question */
  ADD_LEARNING_CONTEXT = 'add_learning_context',
}

// ============================================================================
// REWRITE TEMPLATES
// ============================================================================

/**
 * Templates for rewriting shortcut-seeking prompts
 * These transform "give me answer" into "help me understand"
 */
const SHORTCUT_REWRITE_TEMPLATES: Record<string, string[]> = {
  default: [
    'Can you explain the concept behind this and help me understand how to approach similar problems?',
    'I want to understand the reasoning. Can you guide me through the steps?',
    'Help me understand the underlying concept so I can solve similar problems myself.',
  ],
  math: [
    'Can you explain the mathematical concept here and show me the approach step by step?',
    'Help me understand the method so I can apply it to similar problems.',
    'What is the concept behind this, and how do I approach solving it?',
  ],
  science: [
    'Can you explain the scientific principle behind this?',
    'Help me understand the concept and how it applies here.',
    'What is the underlying theory, and how does it explain this?',
  ],
};

/**
 * Templates for rewriting homework dump prompts
 * These transform bulk submissions into focused learning requests
 */
const HOMEWORK_REWRITE_TEMPLATES: Record<string, string[]> = {
  default: [
    'Let me focus on one question at a time. Can you help me understand how to approach the first concept?',
    'Instead of solving all at once, can you guide me through understanding the key concept here?',
    'Help me learn the method so I can work through these myself. Let\'s start with the main idea.',
  ],
  bulk_to_single: [
    'Let\'s break this down. Can you help me understand the approach for one problem first?',
    'I\'d like to understand the concept first. Can you explain the underlying principle?',
  ],
};

/**
 * Prefixes that transform intent
 */
const LEARNING_PREFIXES: Record<number, string[]> = {
  // Grades 1-3: Very simple, encouraging
  1: [
    'Help me learn about',
    'Can you teach me about',
    'I want to understand',
  ],
  // Grades 4-7: Slightly more complex
  4: [
    'Can you explain the concept of',
    'Help me understand how',
    'Guide me through understanding',
  ],
  // Grades 8-12: Academic language
  8: [
    'Can you explain the underlying principle of',
    'Help me understand the methodology for',
    'Guide me through the conceptual approach to',
  ],
};

// ============================================================================
// REWRITE FUNCTIONS
// ============================================================================

/**
 * Get appropriate learning prefix for grade
 */
function getLearningPrefix(grade: Grade): string {
  let prefixGroup: string[];
  
  if (grade <= 3) {
    prefixGroup = LEARNING_PREFIXES[1];
  } else if (grade <= 7) {
    prefixGroup = LEARNING_PREFIXES[4];
  } else {
    prefixGroup = LEARNING_PREFIXES[8];
  }
  
  return prefixGroup[Math.floor(Math.random() * prefixGroup.length)];
}

/**
 * Get rewrite template for subject
 */
function getRewriteTemplate(subject: string, type: 'shortcut' | 'homework'): string {
  const templates = type === 'shortcut' ? SHORTCUT_REWRITE_TEMPLATES : HOMEWORK_REWRITE_TEMPLATES;
  const subjectLower = subject.toLowerCase();
  
  let templateGroup: string[];
  
  if (subjectLower.includes('math') || subjectLower.includes('algebra') || subjectLower.includes('geometry')) {
    templateGroup = templates.math || templates.default;
  } else if (subjectLower.includes('science') || subjectLower.includes('physics') || subjectLower.includes('chemistry') || subjectLower.includes('biology')) {
    templateGroup = templates.science || templates.default;
  } else {
    templateGroup = templates.default;
  }
  
  return templateGroup[Math.floor(Math.random() * templateGroup.length)];
}

/**
 * Extract the core question from input
 * Removes imperative language while keeping the subject matter
 */
function extractCoreQuestion(input: string): string {
  // Remove common imperative patterns
  let core = input
    // strip 'just tell me' and variants
    .replace(/\bjust\s+tell\s+me(?:\s+what)?\b/gi, '')
    .replace(/\btell\s+me\b/gi, '')
    .replace(/\b(just\s+)?(give|tell)\s+(me\s+)?(the\s+)?answer\s*(to|for|of)?\s*/gi, '')
    .replace(/\bsolve\s+(this|it|these)\s*(for\s+me)?\s*[:.]?\s*/gi, '')
    .replace(/\bdo\s+(this|it|these)\s*(for\s+me)?\s*[:.]?\s*/gi, '')
    .replace(/\b(my\s+)?homework\s*(is|:)?\s*/gi, '')
    .replace(/\b(my\s+)?assignment\s*(is|:)?\s*/gi, '')
    .replace(/\bdue\s+(tomorrow|today|tonight)\s*/gi, '')
    .replace(/\bquickly\s*/gi, '')
    .replace(/\bquestion\s*\d+\s*[-:.]?\s*/gi, '')
    .replace(/\bq\s*\d+\s*[-:.]?\s*/gi, '')
    .replace(/^\s*\d+[.)]\s*/gm, '') // Remove numbered list markers
    .trim();
  
  // Clean up any leftover punctuation at start
  core = core.replace(/^[:\-.\s]+/, '').trim();
  
  return core || input; // Return original if nothing left
}

/**
 * Detect if input contains multiple questions
 */
function hasMultipleQuestions(input: string): boolean {
  const questionIndicators = [
    /\bquestion\s*\d/i,
    /\bq\s*\d/i,
    /^\s*\d+[.)]/m,
    /\d+\)/,
    /\band\s+also\b/i,
    /\bfirst[\s,]+second/i,
    /\b(all|these)\s+(questions|problems)\b/i,
  ];
  
  return questionIndicators.some(pattern => pattern.test(input));
}

/**
 * Rewrite shortcut-seeking prompt
 */
function rewriteShortcutPrompt(context: RewriteContext): RewriteResult {
  const { originalInput, grade, subject, topic } = context;
  const coreQuestion = extractCoreQuestion(originalInput);
  const prefix = getLearningPrefix(grade);
  const template = getRewriteTemplate(subject, 'shortcut');
  
  // If we can identify the core question, use it
  let rewrittenPrompt: string;
  
  if (coreQuestion.length > 10 && coreQuestion !== originalInput) {
    // We extracted a meaningful core question
    // Prefer a template that includes 'explain' so rewritten prompts encourage conceptual learning
    let explainTemplate = getRewriteTemplate(subject, 'shortcut');
    if (!/explain/i.test(explainTemplate)) {
      explainTemplate = `Can you explain? ${explainTemplate}`;
    }
    rewrittenPrompt = topic
      ? `${prefix} ${topic}. ${explainTemplate} Specifically: ${coreQuestion}`
      : `${prefix} ${explainTemplate} Specifically: ${coreQuestion}`;
  } else {
    // Use template-based rewrite
    // Ensure the template encourages explanation wording
    rewrittenPrompt = /explain/i.test(template) ? template : `Can you explain? ${template}`;
  }
  
  return {
    wasRewritten: true,
    prompt: rewrittenPrompt,
    rewrittenPrompt,
    originalPrompt: originalInput,
    strategyApplied: RewriteStrategy.SHORTCUT_TO_LEARNING,
    strategy: RewriteStrategy.SHORTCUT_TO_LEARNING,
    internalReason: 'Shortcut-seeking intent detected; converted to learning-focused prompt',
  };
}

/**
 * Rewrite homework dump prompt
 */
function rewriteHomeworkPrompt(context: RewriteContext): RewriteResult {
  const { originalInput, grade, subject, topic } = context;
  const hasMultiple = hasMultipleQuestions(originalInput);
  const coreQuestion = extractCoreQuestion(originalInput);
  const prefix = getLearningPrefix(grade);
  
  let rewrittenPrompt: string;
  
  if (hasMultiple) {
    // Multiple questions detected - focus on one
    const template = getRewriteTemplate(subject, 'homework');
    rewrittenPrompt = topic
      ? `I'm studying ${topic}. ${template}`
      : template;
  } else {
    // Single homework question - convert to learning request
    rewrittenPrompt = topic
      ? `${prefix} ${topic}. ${coreQuestion}`
      : `${prefix} this concept: ${coreQuestion}`;
  }
  
  const strategyUsed = hasMultiple ? RewriteStrategy.HOMEWORK_TO_CONCEPT : RewriteStrategy.SOLVE_TO_TEACH;
  
  return {
    wasRewritten: true,
    prompt: rewrittenPrompt,
    rewrittenPrompt,
    originalPrompt: originalInput,
    strategyApplied: strategyUsed,
    strategy: strategyUsed,
    internalReason: hasMultiple 
      ? 'Bulk homework detected; converted to single-concept learning request'
      : 'Homework question detected; converted to learning request',
  };
}

/**
 * Add learning context to neutral prompts
 * Used when we're not sure but want to encourage learning behavior
 */
function addLearningContext(context: RewriteContext): RewriteResult {
  const { originalInput, topic } = context;
  
  // Only add context if we have topic info
  if (topic) {
    const contextualPrompt = `While studying ${topic}: ${originalInput}`;
    return {
      wasRewritten: true,
      prompt: contextualPrompt,
      rewrittenPrompt: contextualPrompt,
      originalPrompt: originalInput,
      strategyApplied: RewriteStrategy.ADD_LEARNING_CONTEXT,
      strategy: RewriteStrategy.ADD_LEARNING_CONTEXT,
      internalReason: 'Added learning context to prompt',
    };
  }
  
  // No context to add
  return {
    wasRewritten: false,
    prompt: originalInput,
    rewrittenPrompt: undefined,
    originalPrompt: originalInput,
    strategyApplied: null,
    strategy: null,
    internalReason: null,
  };
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Process and potentially rewrite a student prompt
 * This is the main entry point for the rewrite engine
 * 
 * @param input - Raw student input
 * @param grade - Student's grade level
 * @param subject - Subject being studied
 * @param topic - Optional specific topic
 * @returns RewriteResult with potentially rewritten prompt
 */
export function processPrompt(
  input: string,
  grade: Grade,
  subject: string,
  topic?: string
): RewriteResult {
  // First, classify the intent (pass grade and subject for better context)
  const classification = classifyIntent(input, grade, subject);
  
  const context: RewriteContext = {
    originalInput: input,
    detectedIntent: classification.primaryIntent,
    grade,
    subject,
    topic,
  };
  
  // Apply appropriate rewrite based on intent
  switch (classification.primaryIntent) {
    case StudentIntentCategory.SHORTCUT_SEEKING:
      return rewriteShortcutPrompt(context);
    
    case StudentIntentCategory.HOMEWORK_DUMP:
      return rewriteHomeworkPrompt(context);
    
    case StudentIntentCategory.CONCEPTUAL:
    case StudentIntentCategory.EXAMPLE_REQUEST:
    case StudentIntentCategory.CLARIFICATION:
    case StudentIntentCategory.REVISION:
      // These are legitimate learning intents - no rewrite needed
      return {
        wasRewritten: false,
        prompt: input,
        rewrittenPrompt: undefined,
        originalPrompt: input,
        strategyApplied: null,
        strategy: null,
        internalReason: null,
      };
    
    case StudentIntentCategory.OFF_TOPIC:
    case StudentIntentCategory.UNSAFE:
      // These should be blocked, not rewritten
      // Return original - the block happens at a different layer
      return {
        wasRewritten: false,
        prompt: input,
        rewrittenPrompt: undefined,
        originalPrompt: input,
        strategyApplied: null,
        strategy: null,
        internalReason: 'Intent requires blocking, not rewriting',
      };
    
    default:
      // Unknown intent - optionally add context
      return addLearningContext(context);
  }
}

/**
 * Check if a prompt needs rewriting (without doing the rewrite)
 * Useful for quick checks in pipelines
 */
export function needsRewrite(input: string): boolean {
  const classification = classifyIntent(input);
  
  return classification.primaryIntent === StudentIntentCategory.SHORTCUT_SEEKING ||
         classification.primaryIntent === StudentIntentCategory.HOMEWORK_DUMP;
}

/**
 * Get the rewrite strategy that would be applied
 * Useful for logging and analytics
 */
export function getRewriteStrategy(input: string): RewriteStrategy | null {
  const classification = classifyIntent(input);
  
  switch (classification.primaryIntent) {
    case StudentIntentCategory.SHORTCUT_SEEKING:
      return RewriteStrategy.SHORTCUT_TO_LEARNING;
    case StudentIntentCategory.HOMEWORK_DUMP:
      return hasMultipleQuestions(input)
        ? RewriteStrategy.HOMEWORK_TO_CONCEPT
        : RewriteStrategy.SOLVE_TO_TEACH;
    default:
      return null;
  }
}
