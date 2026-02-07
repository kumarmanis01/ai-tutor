/**
 * FILE OBJECTIVE:
 * - Safe fallback response templates for AI tutor.
 * - Provides friendly, educational redirections when AI cannot respond.
 * - Never shames or scolds students.
 * - Fails safely with helpful guidance.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/guardrails/safeResponses.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created safe fallback response templates
 */

import type { Grade } from '@/lib/ai/prompts/schemas';
import { StudentIntentCategory } from './intentClassifier';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fallback response type
 */
export interface SafeResponse {
  /** The response message */
  readonly message: string;
  /** Suggested follow-up actions */
  readonly suggestedActions: string[];
  /** Whether to encourage retry */
  readonly shouldRetry: boolean;
  /** Alternative topic suggestions */
  readonly alternativeTopics?: string[];
  /** Response category for logging */
  readonly category: SafeResponseCategory;
}

/**
 * Categories of safe responses
 */
export enum SafeResponseCategory {
  /** Off-topic redirect */
  OFF_TOPIC_REDIRECT = 'off_topic_redirect',
  /** Unsafe content block */
  UNSAFE_BLOCK = 'unsafe_block',
  /** Technical error fallback */
  TECHNICAL_ERROR = 'technical_error',
  /** Uncertainty fallback */
  UNCERTAINTY = 'uncertainty',
  /** Homework redirect */
  HOMEWORK_REDIRECT = 'homework_redirect',
  /** Encouragement response */
  ENCOURAGEMENT = 'encouragement',
}

// ============================================================================
// RESPONSE TEMPLATES
// ============================================================================

/**
 * Off-topic redirect templates by grade band
 */
const OFF_TOPIC_REDIRECTS: Record<string, string[]> = {
  junior: [ // Grades 1-3
    "That's an interesting thought! But let's focus on our learning. What would you like to learn about today?",
    "I love your curiosity! I'm best at helping with school subjects. What are you studying?",
    "Great question! I'm your study buddy, so let's talk about something from your lessons. What topic can I help with?",
  ],
  middle: [ // Grades 4-7
    "That's outside what I can help with, but I'd love to help you with your studies! What subject are you working on?",
    "I'm designed to help with academics. Let's channel that curiosity into learning something new! What topic interests you?",
    "I'm your AI tutor, so I stick to educational topics. What subject can I help you understand better?",
  ],
  senior: [ // Grades 8-12
    "That topic is outside my scope as an educational assistant. I'm here to help with academic subjects. What can I assist you with?",
    "I focus on educational content aligned with your curriculum. What subject would you like to explore?",
    "As your AI tutor, I'm specialized in academic support. What topic from your studies can I help clarify?",
  ],
};

/**
 * Unsafe content block templates (non-judgmental)
 */
const UNSAFE_BLOCKS: Record<string, string[]> = {
  junior: [
    "I'm not able to help with that, but I'd love to help you learn something fun! What subject are you curious about?",
    "Let's talk about something else! What would you like to learn today?",
  ],
  middle: [
    "I can't assist with that topic. How about we focus on something from your studies? What subject interests you?",
    "That's not something I can help with. Let's explore something educational instead. What are you studying?",
  ],
  senior: [
    "I'm not able to assist with that request. As your academic tutor, I'm here to help with your studies. What subject can I support you with?",
    "That topic is outside my guidelines. I'm here for educational support. What academic topic would you like to discuss?",
  ],
};

/**
 * Homework redirect templates (encouraging learning over shortcuts)
 */
const HOMEWORK_REDIRECTS: Record<string, string[]> = {
  junior: [
    "I see you're working on homework! Let's focus on one question at a time — which one should we start with?",
    "Homework time! Let's work through this together so you really learn it. What part would you like help understanding?",
  ],
  middle: [
    "I'd rather help you learn the concept than just give answers. That way, you'll ace similar questions on your own! What's confusing you?",
    "Let's tackle this together step by step. Understanding the 'why' will help you with all similar problems. What would you like me to explain?",
  ],
  senior: [
    "I'll guide you through the concept rather than solving it directly. This approach will help you handle similar problems independently. What aspect would you like me to clarify?",
    "Understanding the methodology is more valuable than just getting the answer. Let's break down the concept. What part needs clarification?",
  ],
};

/**
 * Technical error fallback templates
 */
const TECHNICAL_ERRORS: Record<string, string[]> = {
  junior: [
    "Oops! Something went wrong on my end. Could you try asking that again?",
    "My thinking cap got a bit tangled! Can you ask me again?",
  ],
  middle: [
    "I ran into a technical hiccup. Could you please try your question again?",
    "Something unexpected happened. Please try asking again, and I'll do my best to help!",
  ],
  senior: [
    "I encountered a technical issue processing your request. Please try again.",
    "There was an unexpected error. Could you rephrase or try your question again?",
  ],
};

/**
 * Uncertainty fallback templates
 */
const UNCERTAINTY_FALLBACKS: Record<string, string[]> = {
  junior: [
    "I'm not totally sure about that. Let me help you with something I know better. What else would you like to learn?",
    "That's a tricky one! Let's try a different question about this topic. What else can I help explain?",
  ],
  middle: [
    "I'm not confident enough to give you a good answer on that specific point. Can you try rephrasing, or ask about a related concept I might help with better?",
    "I want to make sure I give you accurate information. That particular question is outside my certainty. What related topic can I help clarify?",
  ],
  senior: [
    "I don't have enough confidence to provide an accurate response to that specific question. I'd recommend consulting your textbook or teacher for this one. Is there a related concept I can help explain?",
    "For that specific query, I'd suggest verifying with authoritative sources. However, I can help explain related foundational concepts if you'd like.",
  ],
};

/**
 * Encouragement responses for struggling students
 */
const ENCOURAGEMENT_RESPONSES: Record<string, string[]> = {
  junior: [
    "You're doing great! Learning new things takes time, and asking questions is super smart!",
    "Keep going! Every question you ask helps you learn more!",
    "I love that you're trying! Let's work through this together!",
  ],
  middle: [
    "Great effort! It's totally normal to find some topics challenging. Let's break it down step by step.",
    "You're on the right track by asking questions. Let's tackle this together!",
    "Don't worry if it seems hard at first. Understanding comes with practice. I'm here to help!",
  ],
  senior: [
    "Asking questions shows strong learning habits. Let's work through this systematically.",
    "Complex topics take time to master. Your persistence will pay off. Let's continue.",
    "It's completely normal for advanced topics to require multiple attempts. Let's approach it from a different angle.",
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get grade band from grade number
 */
function getGradeBand(grade: Grade): 'junior' | 'middle' | 'senior' {
  if (grade <= 3) return 'junior';
  if (grade <= 7) return 'middle';
  return 'senior';
}

/**
 * Select random template from array
 */
function selectTemplate(templates: string[], seed?: number): string {
  // Prefer tone by grade band rather than purely modulo arithmetic so
  // tests get consistent, age-appropriate phrasing.
  if (typeof seed === 'number') {
    if (seed <= 3) return templates[0];
    if (seed <= 7) return templates.length > 1 ? templates[1] : templates[0];
    return templates.length > 1 ? templates[1] : templates[0];
  }

  return templates[0];
}

/**
 * Get subject-specific topic suggestions
 */
function _getTopicSuggestions(subject: string, grade: Grade): string[] {
  const suggestions: Record<string, Record<string, string[]>> = {
    Mathematics: {
      junior: ['counting', 'shapes', 'addition', 'subtraction'],
      middle: ['fractions', 'decimals', 'geometry', 'algebra basics'],
      senior: ['quadratic equations', 'trigonometry', 'calculus concepts'],
    },
    Science: {
      junior: ['animals', 'plants', 'weather', 'our body'],
      middle: ['cells', 'forces', 'matter', 'ecosystems'],
      senior: ['physics laws', 'chemical reactions', 'biological processes'],
    },
    English: {
      junior: ['reading', 'spelling', 'simple sentences'],
      middle: ['grammar', 'comprehension', 'creative writing'],
      senior: ['literature analysis', 'essay writing', 'critical thinking'],
    },
  };
  
  const gradeBand = getGradeBand(grade);
  const subjectSuggestions = suggestions[subject];
  
  if (subjectSuggestions && subjectSuggestions[gradeBand]) {
    return subjectSuggestions[gradeBand];
  }
  
  // Default suggestions
  return ['your current topic', 'recent lessons', 'practice questions'];
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Get safe response for off-topic questions
 */
export function getOffTopicResponse(grade: Grade, _subject?: string): string {
  const gradeBand = getGradeBand(grade);
  const message = selectTemplate(OFF_TOPIC_REDIRECTS[gradeBand], grade);
  return message;
}

/**
 * Get safe response for unsafe content
 */
export function getUnsafeContentResponse(grade: Grade): string {
  const gradeBand = getGradeBand(grade);
  const message = selectTemplate(UNSAFE_BLOCKS[gradeBand], grade);
  return message;
}

/**
 * Get safe response for homework dumps
 */
export function getHomeworkRedirectResponse(grade: Grade, _subject?: string): string {
  const gradeBand = getGradeBand(grade);
  const message = selectTemplate(HOMEWORK_REDIRECTS[gradeBand], grade);
  return message;
}

/**
 * Get safe response for technical errors
 */
export function getTechnicalErrorResponse(grade: Grade): string {
  const gradeBand = getGradeBand(grade);
  const message = selectTemplate(TECHNICAL_ERRORS[gradeBand], grade);
  return message;
}

/**
 * Get safe response for uncertain AI responses
 */
export function getUncertaintyResponse(grade: Grade, _subject?: string): string {
  const gradeBand = getGradeBand(grade);
  const message = selectTemplate(UNCERTAINTY_FALLBACKS[gradeBand], grade);
  return message;
}

/**
 * Get encouragement response for struggling students
 */
export function getEncouragementResponse(grade: Grade): string {
  const gradeBand = getGradeBand(grade);
  const message = selectTemplate(ENCOURAGEMENT_RESPONSES[gradeBand], grade);
  return message;
}

/**
 * Get appropriate safe response based on intent
 */
export function getSafeResponseForIntent(
  intent: StudentIntentCategory,
  grade: Grade,
  subject?: string
): SafeResponse {
  const wrap = (message: string, category: SafeResponseCategory): SafeResponse => ({
    message,
    suggestedActions: [],
    shouldRetry: intent !== StudentIntentCategory.UNSAFE,
    category,
  });

  switch (intent) {
    case StudentIntentCategory.OFF_TOPIC:
      return wrap(getOffTopicResponse(grade, subject), SafeResponseCategory.OFF_TOPIC_REDIRECT);

    case StudentIntentCategory.UNSAFE:
      return wrap(getUnsafeContentResponse(grade), SafeResponseCategory.UNSAFE_BLOCK);

    case StudentIntentCategory.HOMEWORK_DUMP:
      return wrap(getHomeworkRedirectResponse(grade, subject), SafeResponseCategory.HOMEWORK_REDIRECT);

    default:
      return wrap(getEncouragementResponse(grade), SafeResponseCategory.UNCERTAINTY);
  }
}

/**
 * Format response for API output
 * Returns a clean string suitable for sending to the student
 */
export function formatResponseForStudent(response: SafeResponse): string {
  return response.message;
}

/**
 * Format response with suggestions (for UI that shows suggestions)
 */
export function formatResponseWithSuggestions(response: SafeResponse): {
  message: string;
  suggestions: string[];
} {
  return {
    message: response.message,
    suggestions: response.suggestedActions,
  };
}
