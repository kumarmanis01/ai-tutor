/**
 * FILE OBJECTIVE:
 * - Grade-wise fallback prompt templates for safe failures.
 * - Never expose system errors or policy language to students.
 * - Tone is friendly, supportive, and encourages learning.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/ai/prompts/fallbacks/templates.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created grade-wise fallback templates
 */

import type { Grade } from '@/lib/ai/prompts/schemas';
import { FailureReason, FallbackStrategy, FailureCategory } from './failureTypes';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Grade bands for fallback templates
 */
export type GradeBand = 'junior' | 'middle' | 'senior';

/**
 * Fallback template structure
 */
export interface FallbackTemplate {
  /** Primary message shown to student */
  readonly message: string;
  /** Suggested action/next step */
  readonly suggestion: string;
  /** Optional emoji for junior grades */
  readonly emoji?: string;
  /** Follow-up prompts to guide student */
  readonly followUpPrompts?: string[];
  /** Whether to show "Try Again" button */
  readonly showRetry: boolean;
  /** Whether to offer human help option */
  readonly offerHumanHelp: boolean;
}

/**
 * Content type for context-aware fallbacks
 */
export type ContentType = 'NOTES' | 'PRACTICE' | 'DOUBT' | 'QUIZ';

// ============================================================================
// GRADE BAND HELPERS
// ============================================================================

/**
 * Get grade band from grade number
 */
export function getGradeBand(grade: Grade): GradeBand {
  if (grade <= 3) return 'junior';
  if (grade <= 7) return 'middle';
  return 'senior';
}

// ============================================================================
// JUNIOR GRADE TEMPLATES (Grades 1-3)
// ============================================================================

/**
 * Fallback templates for junior students (Grades 1-3)
 * 
 * EDUCATION REASONING:
 * - Use simple words and short sentences
 * - Include encouraging emojis
 * - Never use technical or scary language
 * - Focus on trying again as fun, not failure
 */
export const JUNIOR_TEMPLATES: Record<FallbackStrategy, FallbackTemplate> = {
  [FallbackStrategy.SIMPLIFY_AND_RETRY]: {
    message: "sorry — Oops! Let me think again... 😊",
    suggestion: "Can you ask me in a different way? I want to help you! 💭",
    emoji: "🤔",
    followUpPrompts: [
      "What are you learning about?",
      "Which part is confusing?",
      "Would you like a hint?",
    ],
    showRetry: true,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.ADJUST_PARAMETERS]: {
    message: "Hmm, let me try that again!",
    suggestion: "I'm getting my thinking cap on! 🎩",
    emoji: "✨",
    showRetry: true,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.SAFE_RESPONSE]: {
    message: "That's a great question! But I want to make sure I give you the right answer.",
    suggestion: "Let's ask your teacher or parent to help with this one! 👨‍🏫",
    emoji: "🌟",
    followUpPrompts: [
      "Would you like to try a different question?",
      "Should we look at something easier first?",
    ],
    showRetry: false,
    offerHumanHelp: true,
  },
  
  [FallbackStrategy.CONTENT_REDIRECT]: {
    message: "Wow, that's a big question!",
    suggestion: "Let's start with something from your book first, okay? 📚",
    emoji: "🚀",
    followUpPrompts: [
      "What chapter are you studying?",
      "Would you like to see today's lesson?",
    ],
    showRetry: false,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.HUMAN_ESCALATION]: {
    message: "You asked something really interesting!",
    suggestion: "Let's save this so your teacher can see it! 📝",
    emoji: "🌈",
    showRetry: false,
    offerHumanHelp: true,
  },
  
  [FallbackStrategy.GRACEFUL_ERROR]: {
    message: "Oh no! My brain is a little tired right now.",
    suggestion: "Can you try again in a few minutes? I'll be ready! 💪",
    emoji: "😴",
    showRetry: true,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.DELAYED_RETRY]: {
    message: "I'm thinking really hard!",
    suggestion: "Give me a tiny moment... almost there! ⏰",
    emoji: "⌛",
    showRetry: false,
    offerHumanHelp: false,
  },
};

// ============================================================================
// MIDDLE GRADE TEMPLATES (Grades 4-7)
// ============================================================================

/**
 * Fallback templates for middle school students (Grades 4-7)
 * 
 * EDUCATION REASONING:
 * - More mature language but still friendly
 * - Fewer emojis, more substance
 * - Encourage independent thinking
 * - Guide towards proper learning habits
 */
export const MIDDLE_TEMPLATES: Record<FallbackStrategy, FallbackTemplate> = {
  [FallbackStrategy.SIMPLIFY_AND_RETRY]: {
    message: "I'm not sure I understood that correctly.",
    suggestion: "Could you rephrase your question? Try breaking it into smaller parts.",
    followUpPrompts: [
      "What specific concept is confusing you?",
      "Can you show me what you've tried so far?",
      "Which part of the chapter is this from?",
    ],
    showRetry: true,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.ADJUST_PARAMETERS]: {
    message: "Let me approach this differently.",
    suggestion: "I'm recalculating... this might take a moment.",
    showRetry: true,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.SAFE_RESPONSE]: {
    message: "That's a thoughtful question, but I want to be careful to give you accurate information.",
    suggestion: "Let me guide you to the right resources instead.",
    followUpPrompts: [
      "Would you like me to explain a related concept?",
      "Should we review the basics first?",
    ],
    showRetry: false,
    offerHumanHelp: true,
  },
  
  [FallbackStrategy.CONTENT_REDIRECT]: {
    message: "This seems to be outside your current syllabus.",
    suggestion: "Let's focus on what's in your textbook for now. You can explore this later!",
    followUpPrompts: [
      "What topic from your chapter can I help with?",
      "Would you like practice questions on today's lesson?",
    ],
    showRetry: false,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.HUMAN_ESCALATION]: {
    message: "This is a complex question that deserves a detailed answer.",
    suggestion: "I've flagged this for your teacher to review and respond to.",
    showRetry: false,
    offerHumanHelp: true,
  },
  
  [FallbackStrategy.GRACEFUL_ERROR]: {
    message: "I'm experiencing a temporary issue.",
    suggestion: "Please try again in a moment. Your question has been saved.",
    showRetry: true,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.DELAYED_RETRY]: {
    message: "This is taking longer than usual. Please wait.",
    suggestion: "This is taking longer than usual. Please wait.",
    showRetry: false,
    offerHumanHelp: false,
  },
};

// ============================================================================
// SENIOR GRADE TEMPLATES (Grades 8-10)
// ============================================================================

/**
 * Fallback templates for senior students (Grades 8-10)
 * 
 * EDUCATION REASONING:
 * - Professional tone suitable for older students
 * - Honest about limitations
 * - Encourage critical thinking and verification
 * - Prepare for exam-focused mindset
 */
export const SENIOR_TEMPLATES: Record<FallbackStrategy, FallbackTemplate> = {
  [FallbackStrategy.SIMPLIFY_AND_RETRY]: {
    message: "I need more clarity to provide an accurate response. I might be unable to answer this precisely right now.",
    suggestion: "Please specify the exact topic, chapter, and what aspect you need help with.",
    followUpPrompts: [
      "Which specific concept or formula are you asking about?",
      "What have you attempted so far?",
      "Is this for NCERT or board exam preparation?",
    ],
    showRetry: true,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.ADJUST_PARAMETERS]: {
    message: "Recalculating with adjusted parameters.",
    suggestion: "This may take a moment for complex topics.",
    showRetry: true,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.SAFE_RESPONSE]: {
    message: "I cannot verify the accuracy of this response with sufficient confidence.",
    suggestion: "I recommend cross-checking with your textbook or consulting your teacher for this specific question.",
    followUpPrompts: [
      "Would you like me to explain a related concept I'm confident about?",
      "Should I provide the standard formula/definition instead?",
    ],
    showRetry: false,
    offerHumanHelp: true,
  },
  
  [FallbackStrategy.CONTENT_REDIRECT]: {
    message: "This question goes beyond your current curriculum scope.",
    suggestion: "Focus on board exam syllabus topics for now. This can be explored in higher classes.",
    followUpPrompts: [
      "Would you like practice questions from NCERT exercises?",
      "Should I explain the chapter overview?",
    ],
    showRetry: false,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.HUMAN_ESCALATION]: {
    message: "This question requires expert verification.",
    suggestion: "I've queued this for teacher review. You'll receive a notification when answered.",
    showRetry: false,
    offerHumanHelp: true,
  },
  
  [FallbackStrategy.GRACEFUL_ERROR]: {
    message: "Service temporarily unavailable.",
    suggestion: "Your request has been saved. Please retry in 30 seconds.",
    showRetry: true,
    offerHumanHelp: false,
  },
  
  [FallbackStrategy.DELAYED_RETRY]: {
    message: "Processing complex request — this is taking longer than usual.",
    suggestion: "Estimated wait: 10-15 seconds for detailed analysis.",
    showRetry: false,
    offerHumanHelp: false,
  },
};

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

/**
 * All templates indexed by grade band
 */
export const FALLBACK_TEMPLATES: Record<GradeBand, Record<FallbackStrategy, FallbackTemplate>> = {
  junior: JUNIOR_TEMPLATES,
  middle: MIDDLE_TEMPLATES,
  senior: SENIOR_TEMPLATES,
};

// ============================================================================
// CONTENT-TYPE SPECIFIC FALLBACKS
// ============================================================================

/**
 * Get content-type specific messaging
 */
export function getContentTypeFallback(
  contentType: ContentType,
  gradeOrBand: Grade | GradeBand
): Partial<FallbackTemplate> {
  const gradeBand: GradeBand = typeof gradeOrBand === 'number' ? getGradeBand(gradeOrBand) : gradeOrBand;
  const contentMessages: Record<ContentType, Record<GradeBand, string>> = {
    NOTES: {
      junior: "Let's read about something else fun first! 📖",
      middle: "Let me show you a simpler explanation of this topic.",
      senior: "I'll provide the standard textbook explanation instead.",
    },
    PRACTICE: {
      junior: "Let's try an easier puzzle first! 🧩",
      middle: "Let me give you a similar but simpler question to try.",
      senior: "I'll provide a foundational question on this topic.",
    },
    DOUBT: {
      junior: "That's a tricky question! Let me ask you something first...",
      middle: "Let me break down your doubt into smaller parts.",
      senior: "Let me address the core concept behind your question.",
    },
    QUIZ: {
      junior: "Let's practice with easier questions first! ⭐",
      middle: "I'll adjust the quiz difficulty for better practice.",
      senior: "Regenerating questions at appropriate difficulty level.",
    },
  };
  
  return {
    suggestion: contentMessages[contentType][gradeBand],
  };
}

// ============================================================================
// FAILURE REASON SPECIFIC FALLBACKS
// ============================================================================

/**
 * Get failure-reason specific messaging (student-friendly)
 */
export function getFailureReasonFallback(
  reason: FailureReason,
  gradeBand: GradeBand
): Partial<FallbackTemplate> {
  // Homework dump detected
  if (reason === FailureReason.HOMEWORK_DUMP_DETECTED) {
    const messages: Record<GradeBand, FallbackTemplate> = {
      junior: {
        message: "I see you have a lot of questions! 📝",
        suggestion: "Let's work on one question at a time. Which one should we start with?",
        emoji: "🤗",
        showRetry: false,
        offerHumanHelp: false,
      },
      middle: {
        message: "It looks like you've shared multiple questions at once.",
        suggestion: "To help you learn better, let's focus on one question at a time. Which concept is most confusing?",
        showRetry: false,
        offerHumanHelp: false,
      },
      senior: {
        message: "I noticed this appears to be a complete assignment.",
        suggestion: "I'm here to help you understand concepts, not complete assignments. Please ask about specific doubts you have while solving these.",
        showRetry: false,
        offerHumanHelp: false,
      },
    };
    return messages[gradeBand];
  }
  
  // Off syllabus
  if (reason === FailureReason.OFF_SYLLABUS_QUERY) {
    const messages: Record<GradeBand, FallbackTemplate> = {
      junior: {
        message: "Wow, you're curious about big things! 🌟",
        suggestion: "That's wonderful, but let's learn what's in your book first. We can explore more later!",
        emoji: "📚",
        showRetry: false,
        offerHumanHelp: false,
      },
      middle: {
        message: "This topic is beyond your current grade level.",
        suggestion: "It's great that you're curious! For now, let's master your current syllabus first.",
        showRetry: false,
        offerHumanHelp: false,
      },
      senior: {
        message: "This question is outside the scope of your board exam syllabus.",
        suggestion: "I recommend focusing on exam-relevant topics. This can be explored in competitive exam preparation or higher studies.",
        showRetry: false,
        offerHumanHelp: false,
      },
    };
    return messages[gradeBand];
  }
  
  // Abuse detected
  if (reason === FailureReason.ABUSE_DETECTED) {
    // Same message for all grades - serious tone
    return {
      message: "I can only help with educational questions.",
      suggestion: "Let's get back to learning! What topic from your textbook can I help with?",
      showRetry: false,
      offerHumanHelp: false,
    };
  }

  // Safety violation / content blocked - be helpful and suggest another topic
  if (reason === FailureReason.SAFETY_VIOLATION) {
    return {
      message: "I can only help with educational questions. Try asking about a different topic or a specific part of your lesson.",
      suggestion: "What topic from your syllabus would you like help with?",
      showRetry: false,
      offerHumanHelp: false,
    };
  }
  
  return {};
}

// ============================================================================
// MAIN GETTER FUNCTION
// ============================================================================

/**
 * Get complete fallback template for a given context.
 * 
 * @param grade - Student's grade
 * @param strategy - Fallback strategy being applied
 * @param contentType - Optional content type for context
 * @param failureReason - Optional specific failure reason
 * @returns Complete fallback template
 */
export function getFallbackTemplate(...args: any[]): FallbackTemplate {
  // Two supported call styles:
  // 1) (grade: number, strategy: FallbackStrategy, contentType?: ContentType, failureReason?: FailureReason)
  // 2) (contentType: string, grade: number, failureCategory?: FailureCategory)
  let grade: Grade;
  let strategy: FallbackStrategy;
  let contentType: ContentType | undefined;
  let failureReason: FailureReason | undefined;

  if (typeof args[0] === 'string') {
    // contentType-first style used in tests
    const contentArg: string = (args[0] || '').toUpperCase();
    contentType = contentArg as ContentType;
    grade = args[1] as Grade;
    const failureCategory: FailureCategory | undefined = args[2];
    // Map failure category to a reasonable strategy
    const categoryToStrategy: Record<FailureCategory, FallbackStrategy> = {
      [FailureCategory.LOW_CONFIDENCE]: FallbackStrategy.SIMPLIFY_AND_RETRY,
      [FailureCategory.SCHEMA_VIOLATION]: FallbackStrategy.ADJUST_PARAMETERS,
      [FailureCategory.CONTENT_ISSUE]: FallbackStrategy.SAFE_RESPONSE,
      [FailureCategory.TIMEOUT]: FallbackStrategy.DELAYED_RETRY,
      [FailureCategory.RATE_LIMIT]: FallbackStrategy.DELAYED_RETRY,
      [FailureCategory.NETWORK_ERROR]: FallbackStrategy.DELAYED_RETRY,
      [FailureCategory.VALIDATION_FAILED]: FallbackStrategy.SAFE_RESPONSE,
      [FailureCategory.UNKNOWN]: FallbackStrategy.GRACEFUL_ERROR,
      [FailureCategory.CONTENT_BLOCKED]: FallbackStrategy.SAFE_RESPONSE,
    };

    strategy = failureCategory ? (categoryToStrategy[failureCategory] || FallbackStrategy.SAFE_RESPONSE) : FallbackStrategy.SAFE_RESPONSE;
  } else {
    // grade-first style
    grade = args[0] as Grade;
    strategy = args[1] as FallbackStrategy;
    contentType = args[2] as ContentType | undefined;
    failureReason = args[3] as FailureReason | undefined;
  }

  const gradeBand = getGradeBand(grade);
  let template = { ...FALLBACK_TEMPLATES[gradeBand][strategy] };

  // If caller provided a failure category (content-type-first style), add reason-specific overrides
  if (typeof args[0] === 'string' && args[2]) {
    const failureCategory: FailureCategory = args[2];
    // Map category to a failure reason for user-facing messaging
    const categoryToReason: Partial<Record<FailureCategory, FailureReason>> = {
      [FailureCategory.CONTENT_ISSUE]: FailureReason.HALLUCINATED_FACTS,
      [FailureCategory.CONTENT_BLOCKED]: FailureReason.SAFETY_VIOLATION,
      [FailureCategory.SCHEMA_VIOLATION]: FailureReason.MISSING_REQUIRED_FIELD,
      [FailureCategory.TIMEOUT]: FailureReason.API_TIMEOUT,
      [FailureCategory.RATE_LIMIT]: FailureReason.RATE_LIMIT_EXCEEDED,
    };
    const reason = categoryToReason[failureCategory];
    if (reason) {
      const reasonOverride = getFailureReasonFallback(reason, gradeBand);
      template = { ...template, ...reasonOverride };
    }
    // Additional content-type specific message adjustments for timeouts/rate-limits
    if (failureCategory === FailureCategory.TIMEOUT) {
      if (contentType === 'NOTES') {
        template.message = 'This is taking longer than usual. Please wait.';
      } else if (contentType === 'PRACTICE') {
        template.message = 'This operation is taking longer than expected. Please try again shortly.';
      }
    }
    if (failureCategory === FailureCategory.RATE_LIMIT) {
      template.message = contentType === 'PRACTICE'
        ? 'Service is busy right now — please try again later.'
        : 'Service is busy; please wait a moment and try again.';
    }
  }

  if (contentType) {
    const contentOverride = getContentTypeFallback(contentType, gradeBand);
    template = { ...template, ...contentOverride };
  }

  if (failureReason) {
    const reasonOverride = getFailureReasonFallback(failureReason, gradeBand);
    template = { ...template, ...reasonOverride };
  }

  return template;
}

/**
 * Format fallback template into user-facing string.
 */
export function formatFallbackMessage(...args: any[]): string {
  // Support two call styles:
  // 1) (template: FallbackTemplate)
  // 2) (contentType: string, grade: number, failureCategory?: FailureCategory, options?: { studentName?: string; suggestedAction?: string })
  if (typeof args[0] === 'object' && args[0] !== null && 'message' in args[0]) {
    const template: FallbackTemplate = args[0];
    let message = template.message || '';

    if (template.emoji) {
      message = `${template.emoji} ${message}`;
    }

    message += `\n\n${template.suggestion || ''}`;

    if (template.followUpPrompts && template.followUpPrompts.length > 0) {
      message += '\n\nTry asking:\n';
      message += template.followUpPrompts.map((p: string) => `• ${p}`).join('\n');
    }

    return message;
  }

  // Delegate to param-based formatter
  return formatFallbackMessageWithParams(args[0], args[1], args[2], args[3]);
}

/**
 * Flexible formatter supporting either a template object or parameters.
 * Overload 2: formatFallbackMessage(contentType, grade, failureCategory?, options?)
 */
export function formatFallbackMessageWithParams(
  contentType: string,
  grade: Grade,
  failureCategory?: FailureCategory,
  options?: { studentName?: string; suggestedAction?: string }
): string {
  const template = getFallbackTemplate(contentType, grade, failureCategory);
  let message = template.message || '';

  if (template.emoji) {
    message = `${template.emoji} ${message}`;
  }

  if (options?.studentName) {
    message = `${options.studentName}\n${message}`;
  }

  message += `\n\n${template.suggestion || ''}`;

  if (options?.suggestedAction) {
    message += `\n\n${options.suggestedAction}`;
  }

  if (template.followUpPrompts && template.followUpPrompts.length > 0) {
    message += '\n\nTry asking:\n';
    message += template.followUpPrompts.map((p: string) => `• ${p}`).join('\n');
  }

  return message;
}
