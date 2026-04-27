/**
 * FILE OBJECTIVE:
 * - Unified prompt context builder integrating with existing callLLM infrastructure.
 * - Orchestrates prompt construction, API calls, and response validation.
 * - Central entry point for all AI interactions (Notes, Practice, Doubts).
 * - Uses existing callLLM.ts for worker-safe LLM calls with proper logging.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/promptBuilder.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created unified prompt builder with OpenAI integration
 * - 2026-02-04 | claude | integrated with existing callLLM infrastructure
 */

import type {
  NotesInputContract,
  NotesOutputSchema,
  PracticeInputContract,
  PracticeOutputSchema,
  DoubtsInputContract,
  DoubtsOutputSchema,
  PromptMetadata,
} from './schemas';
import { buildSystemPrompt } from './global';
import { buildNotesPrompt } from './notes';
import { buildPracticePrompt } from './practice';
import { buildDoubtsPrompt, isOffTopicQuestion, getOffTopicRedirect } from './doubts';
import { validateLLMResponse, type PromptType } from './validators';
import { callLLM } from '@/lib/callLLM';
import { logger } from '@/lib/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Timeout configuration for different prompt types (ms)
 * Matches the existing callLLM timeout patterns
 */
export const TIMEOUT_CONFIG = {
  notes: 30000,    // Notes generation can take longer
  practice: 35000, // Practice questions with multiple items
  doubts: 20000,   // Quick response for chat
} as const;

/**
 * Retry configuration for API calls
 */
export const RETRY_CONFIG = {
  maxRetries: 2,
  retryDelayMs: 1000,
  retryOnValidationFailure: true,
} as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of a prompt execution
 */
export interface PromptResult<T> {
  /** Whether the execution was successful */
  success: boolean;
  /** The validated response data */
  data: T | null;
  /** Error message if failed */
  error: string | null;
  /** Validation errors if response was invalid */
  validationErrors: string[];
  /** Metadata for tracking */
  metadata: PromptMetadata;
  /** Raw response for debugging (NOT for production use) */
  rawResponse?: string;
  /** Cost in USD if available */
  costUsd?: number;
  /** Latency in ms */
  latencyMs?: number;
  /** Model used */
  model?: string;
}

/**
 * LLM call meta configuration for callLLM integration
 */
interface LLMCallMeta {
  promptType: PromptType;
  board?: string;
  grade?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  language?: string;
  topicId?: string;
  userIdHash?: string;
  sessionId?: string;
  requestId?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate request metadata
 */
function generateMetadata(
  promptType: PromptType,
  userIdHash: string,
  sessionId: string
): PromptMetadata {
  return {
    requestId: `${promptType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    promptType,
    timestamp: new Date().toISOString(),
    userIdHash,
    sessionId,
  };
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the full prompt combining system and user prompts
 * The callLLM function expects a single prompt string
 */
function buildFullPrompt(systemPrompt: string, userPrompt: string): string {
  return `${systemPrompt}\n\n---\n\n${userPrompt}`;
}

// ============================================================================
// NOTES GENERATION
// ============================================================================

/**
 * Generate notes using the schema-first prompt architecture
 * Integrates with existing callLLM infrastructure for worker-safe execution
 */
export async function generateNotes(
  input: NotesInputContract,
  userIdHash: string,
  sessionId: string
): Promise<PromptResult<NotesOutputSchema>> {
  const metadata = generateMetadata('notes', userIdHash, sessionId);
  
  // Build prompts
  const systemPrompt = buildSystemPrompt(input.grade, input.language);
  const userPrompt = buildNotesPrompt(input);
  const fullPrompt = buildFullPrompt(systemPrompt, userPrompt);
  
  // Build meta for callLLM logging and model selection
  const llmMeta: LLMCallMeta = {
    promptType: 'notes',
    board: input.board,
    grade: String(input.grade),
    subject: input.subject,
    chapter: input.chapter,
    topic: input.topic,
    language: input.language,
    topicId: input.topicId,
    userIdHash,
    sessionId,
    requestId: metadata.requestId,
  };
  
  // Execute with retries
  let lastError: string | null = null;
  let lastValidationErrors: string[] = [];
  let rawResponse: string = '';
  let costUsd: number | undefined;
  let latencyMs: number | undefined;
  let model: string | undefined;
  let currentPrompt = fullPrompt;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const result = await callLLM({
        prompt: currentPrompt,
        meta: llmMeta,
        timeoutMs: TIMEOUT_CONFIG.notes,
      });
      
      rawResponse = result.content;
      costUsd = result.costUsd;
      latencyMs = result.latencyMs;
      model = result.model;
      
      // Validate response
      const validation = validateLLMResponse<NotesOutputSchema>(rawResponse, 'notes');
      
      if (validation.valid && validation.data) {
        return {
          success: true,
          data: validation.data,
          error: null,
          validationErrors: [],
          metadata,
          costUsd,
          latencyMs,
          model,
        };
      }
      
      lastValidationErrors = validation.errors;
      
      if (!RETRY_CONFIG.retryOnValidationFailure) {
        break;
      }
      
      // Add validation errors to next attempt context
      if (attempt < RETRY_CONFIG.maxRetries) {
        currentPrompt = `${fullPrompt}\n\n---\n\nPrevious response had errors: ${validation.errors.join(', ')}\nPrevious response:\n${rawResponse}\n\nPlease fix and return valid JSON.`;
        await sleep(RETRY_CONFIG.retryDelayMs);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      logger.error('generateNotes LLM call failed', { error: lastError, attempt, metadata });
      if (attempt < RETRY_CONFIG.maxRetries) {
        await sleep(RETRY_CONFIG.retryDelayMs);
      }
    }
  }
  
  return {
    success: false,
    data: null,
    error: lastError ?? 'Validation failed after retries',
    validationErrors: lastValidationErrors,
    metadata,
    rawResponse,
    costUsd,
    latencyMs,
    model,
  };
}

// ============================================================================
// PRACTICE GENERATION
// ============================================================================

/**
 * Generate practice questions using the schema-first prompt architecture
 * Integrates with existing callLLM infrastructure for worker-safe execution
 */
export async function generatePractice(
  input: PracticeInputContract,
  userIdHash: string,
  sessionId: string
): Promise<PromptResult<PracticeOutputSchema>> {
  const metadata = generateMetadata('practice', userIdHash, sessionId);
  
  // Build prompts
  const systemPrompt = buildSystemPrompt(input.grade, input.language);
  const userPrompt = buildPracticePrompt(input);
  const fullPrompt = buildFullPrompt(systemPrompt, userPrompt);
  
  // Build meta for callLLM logging and model selection
  const llmMeta: LLMCallMeta = {
    promptType: 'practice',
    board: input.board,
    grade: String(input.grade),
    subject: input.subject,
    chapter: input.chapter,
    topic: input.topic,
    language: input.language,
    topicId: input.topicId,
    userIdHash,
    sessionId,
    requestId: metadata.requestId,
  };
  
  // Execute with retries
  let lastError: string | null = null;
  let lastValidationErrors: string[] = [];
  let rawResponse: string = '';
  let costUsd: number | undefined;
  let latencyMs: number | undefined;
  let model: string | undefined;
  let currentPrompt = fullPrompt;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const result = await callLLM({
        prompt: currentPrompt,
        meta: llmMeta,
        timeoutMs: TIMEOUT_CONFIG.practice,
      });
      
      rawResponse = result.content;
      costUsd = result.costUsd;
      latencyMs = result.latencyMs;
      model = result.model;
      
      // Validate response
      const validation = validateLLMResponse<PracticeOutputSchema>(rawResponse, 'practice');
      
      if (validation.valid && validation.data) {
        // Additional check: verify question count
        if (validation.data.questions.length < input.questionCount) {
          lastValidationErrors = [`Expected ${input.questionCount} questions, got ${validation.data.questions.length}`];
          
          if (attempt < RETRY_CONFIG.maxRetries) {
            currentPrompt = `${fullPrompt}\n\n---\n\nYou provided ${validation.data.questions.length} questions but I need exactly ${input.questionCount}. Please provide the complete set.\nPrevious response:\n${rawResponse}`;
            await sleep(RETRY_CONFIG.retryDelayMs);
            continue;
          }
        }
        
        return {
          success: true,
          data: validation.data,
          error: null,
          validationErrors: [],
          metadata,
          costUsd,
          latencyMs,
          model,
        };
      }
      
      lastValidationErrors = validation.errors;
      
      if (!RETRY_CONFIG.retryOnValidationFailure) {
        break;
      }
      
      if (attempt < RETRY_CONFIG.maxRetries) {
        currentPrompt = `${fullPrompt}\n\n---\n\nPrevious response had errors: ${validation.errors.join(', ')}\nPrevious response:\n${rawResponse}\n\nPlease fix and return valid JSON.`;
        await sleep(RETRY_CONFIG.retryDelayMs);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      logger.error('generatePractice LLM call failed', { error: lastError, attempt, metadata });
      if (attempt < RETRY_CONFIG.maxRetries) {
        await sleep(RETRY_CONFIG.retryDelayMs);
      }
    }
  }
  
  return {
    success: false,
    data: null,
    error: lastError ?? 'Validation failed after retries',
    validationErrors: lastValidationErrors,
    metadata,
    rawResponse,
    costUsd,
    latencyMs,
    model,
  };
}

// ============================================================================
// DOUBTS RESPONSE
// ============================================================================

/**
 * Generate doubt response using the schema-first prompt architecture
 * Includes anti-abuse pre-checks
 * Integrates with existing callLLM infrastructure for worker-safe execution
 */
export async function generateDoubtResponse(
  input: DoubtsInputContract,
  userIdHash: string,
  sessionId: string
): Promise<PromptResult<DoubtsOutputSchema>> {
  const metadata = generateMetadata('doubts', userIdHash, sessionId);
  
  // Pre-check: Is this an off-topic/inappropriate question?
  if (isOffTopicQuestion(input.studentQuestion, input.subject)) {
    const redirect = getOffTopicRedirect(input.subject);
    return {
      success: true,
      data: redirect,
      error: null,
      validationErrors: [],
      metadata,
    };
  }
  
  // Build prompts
  const systemPrompt = buildSystemPrompt(input.grade, input.language);
  const userPrompt = buildDoubtsPrompt(input);
  const fullPrompt = buildFullPrompt(systemPrompt, userPrompt);
  
  // Build meta for callLLM logging and model selection
  const llmMeta: LLMCallMeta = {
    promptType: 'doubts',
    board: input.board,
    grade: String(input.grade),
    subject: input.subject,
    chapter: input.chapter,
    topic: input.topic,
    language: input.language,
    topicId: input.topicId,
    userIdHash,
    sessionId,
    requestId: metadata.requestId,
  };
  
  // Execute with retries
  let lastError: string | null = null;
  let lastValidationErrors: string[] = [];
  let rawResponse: string = '';
  let costUsd: number | undefined;
  let latencyMs: number | undefined;
  let model: string | undefined;
  let currentPrompt = fullPrompt;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const result = await callLLM({
        prompt: currentPrompt,
        meta: llmMeta,
        timeoutMs: TIMEOUT_CONFIG.doubts,
      });
      
      rawResponse = result.content;
      costUsd = result.costUsd;
      latencyMs = result.latencyMs;
      model = result.model;
      
      // Validate response
      const validation = validateLLMResponse<DoubtsOutputSchema>(rawResponse, 'doubts');
      
      if (validation.valid && validation.data) {
        return {
          success: true,
          data: validation.data,
          error: null,
          validationErrors: [],
          metadata,
          costUsd,
          latencyMs,
          model,
        };
      }
      
      lastValidationErrors = validation.errors;
      
      if (!RETRY_CONFIG.retryOnValidationFailure) {
        break;
      }
      
      if (attempt < RETRY_CONFIG.maxRetries) {
        currentPrompt = `${fullPrompt}\n\n---\n\nPrevious response had errors: ${validation.errors.join(', ')}\nPrevious response:\n${rawResponse}\n\nPlease fix and return valid JSON.`;
        await sleep(RETRY_CONFIG.retryDelayMs);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      logger.error('generateDoubtResponse LLM call failed', { error: lastError, attempt, metadata });
      if (attempt < RETRY_CONFIG.maxRetries) {
        await sleep(RETRY_CONFIG.retryDelayMs);
      }
    }
  }
  
  return {
    success: false,
    data: null,
    error: lastError ?? 'Validation failed after retries',
    validationErrors: lastValidationErrors,
    metadata,
    rawResponse,
    costUsd,
    latencyMs,
    model,
  };
}
