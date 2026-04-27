/**
 * FILE OBJECTIVE:
 * - Resolve and manage session intent.
 * - Modify AI prompts based on intent.
 * - Handle fallback behavior for junior grades.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/sessionIntent/resolver.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created session intent resolver
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SessionIntent,
  IntentUrgency,
  StudentMood,
  INTENT_MODIFIERS,
  getIntentConfig,
  getIntentModifiers,
  isIntentValidForGrade,
  type SessionIntentData,
  type IntentPromptModifiers,
  type GradeIntentConfig,
} from './schemas';

// ============================================================================
// INTENT RESOLUTION
// ============================================================================

export interface IntentResolutionInput {
  /** Student grade */
  grade: number;
  /** Explicitly stated intent (if any) */
  statedIntent?: SessionIntent;
  /** Urgency level */
  urgency?: IntentUrgency;
  /** Current mood */
  mood?: StudentMood;
  /** Specific topic */
  topicFocus?: string;
  /** Time available */
  availableMinutes?: number;
  /** Self-reported confidence */
  selfConfidence?: number;
  /** Context from recent activity */
  recentActivity?: {
    lastTopic?: string;
    lastIntent?: SessionIntent;
    daysSinceLastSession: number;
    hasUpcomingExam: boolean;
    examDaysAway?: number;
  };
}

export interface ResolvedIntent {
  /** The resolved intent data */
  intentData: SessionIntentData;
  /** How the intent was determined */
  resolutionMethod: 'explicit' | 'inferred' | 'default';
  /** Confidence in the resolution (0-1) */
  confidence: number;
  /** Prompt modifiers to apply */
  modifiers: IntentPromptModifiers;
  /** Grade config used */
  gradeConfig: GradeIntentConfig;
}

/**
 * Resolve session intent from input.
 * Handles explicit, inferred, and default cases.
 */
export function resolveSessionIntent(input: IntentResolutionInput): ResolvedIntent {
  const gradeConfig = getIntentConfig(input.grade);
  const sessionId = uuidv4();
  
  let intent: SessionIntent;
  let resolutionMethod: 'explicit' | 'inferred' | 'default';
  let confidence: number;
  
  // Case 1: Explicit intent provided
  if (input.statedIntent && isIntentValidForGrade(input.statedIntent, input.grade)) {
    intent = input.statedIntent;
    resolutionMethod = 'explicit';
    confidence = 0.95;
  }
  // Case 2: Infer intent from context
  else if (input.recentActivity) {
    const inferred = inferIntentFromContext(input, gradeConfig);
    intent = inferred.intent;
    resolutionMethod = 'inferred';
    confidence = inferred.confidence;
  }
  // Case 3: Use default
  else {
    intent = gradeConfig.defaultIntent;
    resolutionMethod = 'default';
    confidence = 0.5;
  }
  
  // Build intent data
  const intentData: SessionIntentData = {
    intent,
    urgency: input.urgency ?? IntentUrgency.NORMAL,
    mood: input.mood,
    topicFocus: input.topicFocus,
    availableMinutes: input.availableMinutes,
    selfConfidence: input.selfConfidence,
    capturedAt: new Date().toISOString(),
    sessionId,
  };
  
  // Get modifiers for this intent
  const modifiers = getIntentModifiers(intent);
  
  // Apply adjustments based on urgency and mood
  const adjustedModifiers = applyContextAdjustments(modifiers, input);
  
  return {
    intentData,
    resolutionMethod,
    confidence,
    modifiers: adjustedModifiers,
    gradeConfig,
  };
}

/**
 * Infer intent from context clues.
 */
function inferIntentFromContext(
  input: IntentResolutionInput,
  config: GradeIntentConfig
): { intent: SessionIntent; confidence: number } {
  const { recentActivity, selfConfidence, availableMinutes } = input;
  
  // Exam coming up?
  if (recentActivity?.hasUpcomingExam) {
    const daysAway = recentActivity.examDaysAway ?? 7;
    
    if (daysAway <= 2) {
      return { intent: SessionIntent.EXAM_PREP, confidence: 0.85 };
    }
    if (daysAway <= 7) {
      return { intent: SessionIntent.BUILD_CONFIDENCE, confidence: 0.75 };
    }
    return { intent: SessionIntent.REVISE, confidence: 0.70 };
  }
  
  // Low confidence? Build it up
  if (selfConfidence !== undefined && selfConfidence <= 2) {
    return { intent: SessionIntent.BUILD_CONFIDENCE, confidence: 0.75 };
  }
  
  // Short time available? Quick practice
  if (availableMinutes !== undefined && availableMinutes <= 15) {
    return { intent: SessionIntent.PRACTICE, confidence: 0.70 };
  }
  
  // Returning after long break? Revise
  if (recentActivity && recentActivity.daysSinceLastSession >= 3) {
    return { intent: SessionIntent.REVISE, confidence: 0.65 };
  }
  
  // Continue what they were doing
  if (recentActivity?.lastIntent && config.availableIntents.includes(recentActivity.lastIntent)) {
    return { intent: recentActivity.lastIntent, confidence: 0.60 };
  }
  
  // Default to learning new concept
  return { intent: config.defaultIntent, confidence: 0.50 };
}

/**
 * Apply context-based adjustments to modifiers.
 */
function applyContextAdjustments(
  modifiers: IntentPromptModifiers,
  input: IntentResolutionInput
): IntentPromptModifiers {
  const adjusted = { ...modifiers };
  
  // Urgent? Be more focused
  if (input.urgency === IntentUrgency.HIGH || input.urgency === IntentUrgency.CRITICAL) {
    adjusted.responseLength = 'concise';
    adjusted.includeExamTips = true;
    adjusted.toneAdjustment = 'focused';
  }
  
  // Anxious mood? Be encouraging
  if (input.mood === StudentMood.ANXIOUS) {
    adjusted.toneAdjustment = 'encouraging';
    adjusted.difficultyBias = 'easier';
  }
  
  // Low confidence? Start easier
  if (input.selfConfidence !== undefined && input.selfConfidence <= 2) {
    adjusted.difficultyBias = 'easier';
    adjusted.toneAdjustment = 'encouraging';
    adjusted.exampleCount = Math.max(adjusted.exampleCount, 2);
  }
  
  // Limited time? Be concise
  if (input.availableMinutes !== undefined && input.availableMinutes <= 15) {
    adjusted.responseLength = 'concise';
    adjusted.explanationDepth = Math.min(adjusted.explanationDepth, 3) as 1 | 2 | 3 | 4 | 5;
    adjusted.exampleCount = Math.min(adjusted.exampleCount, 1);
  }
  
  return adjusted;
}

// ============================================================================
// PROMPT MODIFICATION
// ============================================================================

/**
 * Build system prompt additions based on intent.
 */
export function buildIntentSystemPrompt(resolved: ResolvedIntent): string {
  const { intentData, modifiers } = resolved;
  
  const lines: string[] = [];
  
  // Intent context
  lines.push(`## Session Intent Context`);
  lines.push(`Student's goal this session: ${formatIntentDescription(intentData.intent)}`);
  
  // Urgency
  if (intentData.urgency !== IntentUrgency.NORMAL) {
    lines.push(`Urgency level: ${intentData.urgency}`);
  }
  
  // Tone guidance
  lines.push('');
  lines.push(`## Response Guidelines`);
  lines.push(`- Explanation depth: ${modifiers.explanationDepth}/5`);
  lines.push(`- Response length: ${modifiers.responseLength}`);
  lines.push(`- Tone: ${modifiers.toneAdjustment}`);
  
  if (modifiers.includeExamples) {
    lines.push(`- Include ${modifiers.exampleCount} example(s)`);
  }
  
  if (modifiers.includePractice) {
    lines.push(`- Include practice question(s), difficulty bias: ${modifiers.difficultyBias}`);
  }
  
  if (modifiers.includeMemoryTips) {
    lines.push(`- Include memory/retention tips when relevant`);
  }
  
  if (modifiers.includeExamTips) {
    lines.push(`- Include exam-specific tips and common mistakes`);
  }
  
  // Specific topic focus
  if (intentData.topicFocus) {
    lines.push('');
    lines.push(`Focus area: ${intentData.topicFocus}`);
  }
  
  return lines.join('\n');
}

/**
 * Build user prompt prefix based on intent.
 */
export function buildIntentUserPromptPrefix(resolved: ResolvedIntent): string {
  const { intentData, modifiers } = resolved;
  
  const prefixes: Record<SessionIntent, string> = {
    [SessionIntent.LEARN_CONCEPT]: 'I want to learn about',
    [SessionIntent.PRACTICE]: 'I need practice questions on',
    [SessionIntent.REVISE]: 'Help me revise',
    [SessionIntent.BUILD_CONFIDENCE]: 'I need to build confidence in',
    [SessionIntent.EXAM_PREP]: 'Help me prepare for my exam on',
    [SessionIntent.EXPLORE]: 'Tell me something interesting about',
    [SessionIntent.HOMEWORK_HELP]: 'I need help with my homework on',
  };
  
  return prefixes[intentData.intent] || 'Help me with';
}

/**
 * Format intent as human-readable description.
 */
function formatIntentDescription(intent: SessionIntent): string {
  const descriptions: Record<SessionIntent, string> = {
    [SessionIntent.LEARN_CONCEPT]: 'Learning new concepts from scratch',
    [SessionIntent.PRACTICE]: 'Practicing with questions and problems',
    [SessionIntent.REVISE]: 'Reviewing and revising learned material',
    [SessionIntent.BUILD_CONFIDENCE]: 'Building confidence before assessment',
    [SessionIntent.EXAM_PREP]: 'Focused exam preparation',
    [SessionIntent.EXPLORE]: 'Exploring and discovering',
    [SessionIntent.HOMEWORK_HELP]: 'Getting help with homework',
  };
  
  return descriptions[intent];
}

// ============================================================================
// FALLBACK BEHAVIOR (JUNIOR GRADES)
// ============================================================================

/**
 * Create safe default intent for junior grades.
 * No prompt shown, intent auto-detected.
 */
export function createJuniorDefaultIntent(grade: number, sessionId?: string): ResolvedIntent {
  const config = getIntentConfig(grade);
  
  const intentData: SessionIntentData = {
    intent: SessionIntent.LEARN_CONCEPT,
    urgency: IntentUrgency.LOW, // No pressure for young kids
    capturedAt: new Date().toISOString(),
    sessionId: sessionId ?? uuidv4(),
  };
  
  const modifiers = getIntentModifiers(SessionIntent.LEARN_CONCEPT);
  
  // Adjust for junior: more encouraging, simpler
  const juniorModifiers: IntentPromptModifiers = {
    ...modifiers,
    explanationDepth: 2, // Keep it simple
    toneAdjustment: 'encouraging',
    responseLength: 'concise',
    includeExamTips: false, // No exam stress for young kids
  };
  
  return {
    intentData,
    resolutionMethod: 'default',
    confidence: 1.0, // Confident in safe default
    modifiers: juniorModifiers,
    gradeConfig: config,
  };
}

/**
 * Check if intent prompt should be shown.
 */
export function shouldShowIntentPrompt(grade: number): boolean {
  const config = getIntentConfig(grade);
  return config.showPrompt;
}

/**
 * Check if intent is required for this grade.
 */
export function isIntentRequired(grade: number): boolean {
  const config = getIntentConfig(grade);
  return config.intentRequired;
}
