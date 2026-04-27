/**
 * FILE OBJECTIVE:
 * - Detect when a student is stuck.
 * - Map stuck states to recovery actions.
 * - Generate grade-appropriate recovery messages.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/failureRecovery/detector.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created failure recovery detector
 */

import {
  StuckIndicator,
  StuckSeverity,
  RecoveryAction,
  getRecoveryConfig,
  type StudentState,
  type StuckDetectionResult,
  type RecoveryPlan,
  type GradeRecoveryConfig,
  type DetectionThresholds,
} from './schemas';

// ============================================================================
// STUCK DETECTION
// ============================================================================

/**
 * Detect if a student is stuck based on their current state.
 */
export function detectStuckState(state: StudentState): StuckDetectionResult {
  const config = getRecoveryConfig(state.grade);
  const thresholds = config.thresholds;
  
  const indicators: StuckIndicator[] = [];
  let severityScore = 0;
  
  // Check each indicator
  if (state.retryCount >= thresholds.retryThreshold) {
    indicators.push(StuckIndicator.MULTIPLE_RETRIES);
    severityScore += state.retryCount >= thresholds.retryThreshold * 2 ? 2 : 1;
  }
  
  if (state.timeOnCurrentItem > state.expectedTime * thresholds.timeMultiplierThreshold) {
    indicators.push(StuckIndicator.LONG_TIME);
    severityScore += state.timeOnCurrentItem > state.expectedTime * 3 ? 2 : 1;
  }
  
  if (state.hintsUsed >= thresholds.hintThreshold) {
    indicators.push(StuckIndicator.MANY_HINTS);
    severityScore += 1;
  }
  
  // Check recent confidence
  if (state.recentConfidences.length >= 3) {
    const avgConfidence = state.recentConfidences.slice(-3).reduce((a, b) => a + b, 0) / 3;
    if (avgConfidence < thresholds.lowConfidenceThreshold) {
      indicators.push(StuckIndicator.LOW_CONFIDENCE);
      severityScore += avgConfidence < 0.3 ? 2 : 1;
    }
  }
  
  // Check recent correctness
  if (state.recentCorrectness.length >= 3) {
    const recentWrong = state.recentCorrectness.slice(-3).filter(c => !c).length;
    if (recentWrong >= thresholds.wrongAnswerThreshold) {
      indicators.push(StuckIndicator.REPEATED_WRONG);
      severityScore += 2;
    }
  }
  
  if (state.skippedCount >= thresholds.skipThreshold) {
    indicators.push(StuckIndicator.SKIPPING);
    severityScore += 1;
  }
  
  if (state.idleTime >= thresholds.idleThreshold) {
    indicators.push(StuckIndicator.IDLE);
    severityScore += state.idleTime >= thresholds.idleThreshold * 2 ? 2 : 1;
  }
  
  if (state.helpRequested) {
    indicators.push(StuckIndicator.HELP_REQUESTED);
    severityScore += 2; // Explicit request is high priority
  }
  
  // Consider mood if available
  if (state.mood === 'anxious') {
    severityScore += 1;
  }
  
  // Determine if stuck
  const isStuck = indicators.length >= 2 || 
                  severityScore >= 3 || 
                  state.helpRequested;
  
  // Determine severity
  let severity: StuckSeverity | undefined;
  if (isStuck) {
    if (severityScore >= 6 || state.helpRequested) {
      severity = StuckSeverity.CRITICAL;
    } else if (severityScore >= 4) {
      severity = StuckSeverity.HIGH;
    } else if (severityScore >= 2) {
      severity = StuckSeverity.MODERATE;
    } else {
      severity = StuckSeverity.MILD;
    }
  }
  
  // Determine primary cause
  const primaryCause = determinePrimaryCause(indicators, state);
  
  // Calculate confidence
  const confidence = Math.min(0.5 + (indicators.length * 0.15), 0.95);
  
  return {
    isStuck,
    indicators,
    severity,
    confidence,
    primaryCause,
    detectedAt: new Date().toISOString(),
  };
}

/**
 * Determine the most likely cause of being stuck.
 */
function determinePrimaryCause(
  indicators: StuckIndicator[],
  state: StudentState
): string | undefined {
  // Priority order of causes
  if (indicators.includes(StuckIndicator.HELP_REQUESTED)) {
    return 'Student explicitly requested help';
  }
  
  if (indicators.includes(StuckIndicator.REPEATED_WRONG)) {
    return 'Concept not fully understood';
  }
  
  if (indicators.includes(StuckIndicator.LOW_CONFIDENCE)) {
    return 'Lack of confidence in understanding';
  }
  
  if (indicators.includes(StuckIndicator.LONG_TIME)) {
    return 'Difficulty processing the problem';
  }
  
  if (indicators.includes(StuckIndicator.MULTIPLE_RETRIES)) {
    return 'Struggling with this specific question';
  }
  
  if (indicators.includes(StuckIndicator.MANY_HINTS)) {
    return 'Need more foundational understanding';
  }
  
  if (indicators.includes(StuckIndicator.IDLE)) {
    return 'May be distracted or unsure how to proceed';
  }
  
  if (indicators.includes(StuckIndicator.SKIPPING)) {
    return 'Topic may be too difficult';
  }
  
  return undefined;
}

// ============================================================================
// RECOVERY PLANNING
// ============================================================================

/**
 * Create a recovery plan for a stuck student.
 */
export function createRecoveryPlan(
  state: StudentState,
  detection: StuckDetectionResult
): RecoveryPlan {
  const config = getRecoveryConfig(state.grade);
  
  // Select recovery actions based on indicators and severity
  const actions = selectRecoveryActions(detection, config);
  const primaryAction = actions[0];
  const alternativeActions = actions.slice(1, 3);
  
  // Generate message
  const message = generateRecoveryMessage(
    primaryAction,
    state,
    detection,
    config
  );
  
  // Generate action button text
  const buttonText = getActionButtonText(primaryAction, config);
  
  // Generate secondary option
  const secondaryOption = alternativeActions.length > 0
    ? getSecondaryOptionText(alternativeActions[0], config)
    : undefined;
  
  return {
    detection,
    primaryAction,
    alternativeActions,
    studentMessage: message,
    actionButtonText: buttonText,
    secondaryOption,
    showEncouragement: detection.severity !== StuckSeverity.MILD,
    estimatedRecoveryTime: estimateRecoveryTime(primaryAction),
    trackDismissal: detection.severity === StuckSeverity.HIGH || 
                     detection.severity === StuckSeverity.CRITICAL,
  };
}

/**
 * Select appropriate recovery actions.
 */
function selectRecoveryActions(
  detection: StuckDetectionResult,
  config: GradeRecoveryConfig
): RecoveryAction[] {
  const actions: RecoveryAction[] = [];
  const { indicators, severity } = detection;
  
  // Map indicators to appropriate actions
  if (indicators.includes(StuckIndicator.REPEATED_WRONG) || 
      indicators.includes(StuckIndicator.LOW_CONFIDENCE)) {
    actions.push(RecoveryAction.SIMPLER_EXPLANATION);
    actions.push(RecoveryAction.ALTERNATE_EXAMPLE);
  }
  
  if (indicators.includes(StuckIndicator.LONG_TIME)) {
    actions.push(RecoveryAction.BREAK_DOWN_STEPS);
  }
  
  if (indicators.includes(StuckIndicator.MANY_HINTS)) {
    actions.push(RecoveryAction.SUGGEST_REVISION);
  }
  
  if (indicators.includes(StuckIndicator.IDLE)) {
    actions.push(RecoveryAction.ENCOURAGE);
    actions.push(RecoveryAction.SUGGEST_BREAK);
  }
  
  if (indicators.includes(StuckIndicator.SKIPPING)) {
    actions.push(RecoveryAction.EASIER_PRACTICE);
    actions.push(RecoveryAction.SWITCH_TOPIC);
  }
  
  if (indicators.includes(StuckIndicator.HELP_REQUESTED)) {
    actions.push(RecoveryAction.BREAK_DOWN_STEPS);
    actions.push(RecoveryAction.SHOW_SOLUTION);
  }
  
  // Critical severity may need human help
  if (severity === StuckSeverity.CRITICAL) {
    actions.push(RecoveryAction.HUMAN_HELP);
  }
  
  // Prioritize based on grade preferences
  const prioritized = actions
    .filter(a => config.preferredActions.includes(a))
    .sort((a, b) => 
      config.preferredActions.indexOf(a) - config.preferredActions.indexOf(b)
    );
  
  // Add non-preferred actions at the end
  const nonPreferred = actions.filter(a => !config.preferredActions.includes(a));
  
  // Combine and dedupe
  const combined = [...new Set([...prioritized, ...nonPreferred])];
  
  // Ensure we have at least one action
  if (combined.length === 0) {
    combined.push(config.preferredActions[0] || RecoveryAction.ENCOURAGE);
  }
  
  return combined;
}

/**
 * Generate an encouraging recovery message.
 */
function generateRecoveryMessage(
  action: RecoveryAction,
  state: StudentState,
  detection: StuckDetectionResult,
  config: GradeRecoveryConfig
): string {
  const templates = getMessageTemplates(action, config.messageTone);
  
  // Select appropriate template
  let message = templates[Math.floor(Math.random() * templates.length)];
  
  // Add emoji for playful/supportive tones
  if (config.useEmojis) {
    message = addEmoji(message, action);
  }
  
  // Ensure message fits length limit
  if (message.length > config.maxMessageLength) {
    message = message.substring(0, config.maxMessageLength - 3) + '...';
  }
  
  return message;
}

/**
 * Get message templates for an action and tone.
 */
function getMessageTemplates(
  action: RecoveryAction,
  tone: 'playful' | 'supportive' | 'focused'
): string[] {
  const templates: Record<RecoveryAction, Record<typeof tone, string[]>> = {
    [RecoveryAction.SIMPLER_EXPLANATION]: {
      playful: [
        "Let me explain this in a different way!",
        "I've got another way to show you this!",
      ],
      supportive: [
        "Let me try explaining this differently. Sometimes a fresh perspective helps!",
        "Here's another way to think about this concept.",
      ],
      focused: [
        "Let me provide an alternative explanation that may be clearer.",
        "Here's a different approach to understanding this concept.",
      ],
    },
    [RecoveryAction.ALTERNATE_EXAMPLE]: {
      playful: [
        "Check out this cool example!",
        "Here's a fun example that might help!",
      ],
      supportive: [
        "Here's a different example that might make things clearer.",
        "Let me show you another example to help.",
      ],
      focused: [
        "Consider this alternative example.",
        "This additional example may clarify the concept.",
      ],
    },
    [RecoveryAction.SUGGEST_REVISION]: {
      playful: [
        "Let's do a quick review first!",
        "Want to look at some basics real quick?",
      ],
      supportive: [
        "It might help to quickly review some related concepts. Want to try that?",
        "Let's strengthen your foundation a bit. It'll make this easier!",
      ],
      focused: [
        "Reviewing the prerequisites may help. Would you like to do that?",
        "Consider revisiting the foundational concepts before continuing.",
      ],
    },
    [RecoveryAction.BREAK_DOWN_STEPS]: {
      playful: [
        "Let's break this into tiny pieces!",
        "Let me show you step by step!",
      ],
      supportive: [
        "Let's take this one step at a time. It's easier that way!",
        "I'll break this down into smaller steps for you.",
      ],
      focused: [
        "Let me break this down into smaller, manageable steps.",
        "Here's a step-by-step approach to this problem.",
      ],
    },
    [RecoveryAction.EASIER_PRACTICE]: {
      playful: [
        "Want to try some easier ones first?",
        "Let's warm up with something simpler!",
      ],
      supportive: [
        "How about we try some easier questions first to build up?",
        "Let's practice with something simpler to build your confidence.",
      ],
      focused: [
        "Would you like to practice with some foundational questions first?",
        "Consider starting with simpler problems to build understanding.",
      ],
    },
    [RecoveryAction.VISUAL_AID]: {
      playful: [
        "Look at this picture! It'll help!",
        "Here's a cool diagram for you!",
      ],
      supportive: [
        "This visual might help you understand better.",
        "Let me show you a diagram that explains this.",
      ],
      focused: [
        "This diagram illustrates the concept.",
        "Consider this visual representation.",
      ],
    },
    [RecoveryAction.SUGGEST_BREAK]: {
      playful: [
        "How about a quick break? You're doing great!",
        "Time for a little rest! You deserve it!",
      ],
      supportive: [
        "You've been working hard! A short break might help clear your mind.",
        "Sometimes a quick break helps. Take your time!",
      ],
      focused: [
        "Consider taking a short break. Fresh perspective often helps.",
        "A brief break may help you approach this with renewed focus.",
      ],
    },
    [RecoveryAction.SWITCH_TOPIC]: {
      playful: [
        "Want to explore something else for now?",
        "Let's try something different!",
      ],
      supportive: [
        "Would you like to switch to a different topic for now?",
        "We can come back to this later. Want to try something else?",
      ],
      focused: [
        "Consider moving to a different topic and returning to this later.",
        "Would you prefer to work on a different area for now?",
      ],
    },
    [RecoveryAction.SHOW_SOLUTION]: {
      playful: [
        "Want to see how it's done?",
        "Let me show you the answer!",
      ],
      supportive: [
        "Would you like to see the solution? Sometimes that helps learning.",
        "Let me show you the worked solution so you can learn from it.",
      ],
      focused: [
        "Here's the complete solution for your reference.",
        "Review this worked example to understand the approach.",
      ],
    },
    [RecoveryAction.HUMAN_HELP]: {
      playful: [
        "Want to ask a teacher for help?",
        "Should we ask a grown-up?",
      ],
      supportive: [
        "Would you like to connect with a teacher or tutor for extra help?",
        "Sometimes talking to a teacher helps. Want me to connect you?",
      ],
      focused: [
        "Would you like to request assistance from a human tutor?",
        "Consider reaching out to a teacher for additional guidance.",
      ],
    },
    [RecoveryAction.ENCOURAGE]: {
      playful: [
        "You're doing awesome! Keep trying!",
        "You've got this! I believe in you!",
      ],
      supportive: [
        "You're doing great! Keep going, you'll get it.",
        "Don't give up! Every mistake is a learning opportunity.",
      ],
      focused: [
        "Persistence is key. Keep working through it.",
        "You're making progress. Continue your efforts.",
      ],
    },
  };
  
  return templates[action]?.[tone] || templates[RecoveryAction.ENCOURAGE][tone];
}

/**
 * Add appropriate emoji to message.
 */
function addEmoji(message: string, action: RecoveryAction): string {
  const emojis: Record<RecoveryAction, string> = {
    [RecoveryAction.SIMPLER_EXPLANATION]: '💡',
    [RecoveryAction.ALTERNATE_EXAMPLE]: '📝',
    [RecoveryAction.SUGGEST_REVISION]: '📚',
    [RecoveryAction.BREAK_DOWN_STEPS]: '🔢',
    [RecoveryAction.EASIER_PRACTICE]: '🌱',
    [RecoveryAction.VISUAL_AID]: '🖼️',
    [RecoveryAction.SUGGEST_BREAK]: '☕',
    [RecoveryAction.SWITCH_TOPIC]: '🔄',
    [RecoveryAction.SHOW_SOLUTION]: '✨',
    [RecoveryAction.HUMAN_HELP]: '🙋',
    [RecoveryAction.ENCOURAGE]: '💪',
  };
  
  return `${emojis[action] || '💫'} ${message}`;
}

/**
 * Get button text for action.
 */
function getActionButtonText(
  action: RecoveryAction,
  config: GradeRecoveryConfig
): string {
  const texts: Record<RecoveryAction, Record<typeof config.messageTone, string>> = {
    [RecoveryAction.SIMPLER_EXPLANATION]: {
      playful: 'Show me!',
      supportive: 'Explain again',
      focused: 'View explanation',
    },
    [RecoveryAction.ALTERNATE_EXAMPLE]: {
      playful: 'See example!',
      supportive: 'Show example',
      focused: 'View example',
    },
    [RecoveryAction.SUGGEST_REVISION]: {
      playful: 'Quick review!',
      supportive: 'Review basics',
      focused: 'Review prerequisites',
    },
    [RecoveryAction.BREAK_DOWN_STEPS]: {
      playful: 'Step by step!',
      supportive: 'Break it down',
      focused: 'View steps',
    },
    [RecoveryAction.EASIER_PRACTICE]: {
      playful: 'Easier ones!',
      supportive: 'Try easier',
      focused: 'Foundational practice',
    },
    [RecoveryAction.VISUAL_AID]: {
      playful: 'Show picture!',
      supportive: 'See diagram',
      focused: 'View visual',
    },
    [RecoveryAction.SUGGEST_BREAK]: {
      playful: 'Take a break!',
      supportive: 'Take a break',
      focused: 'Pause session',
    },
    [RecoveryAction.SWITCH_TOPIC]: {
      playful: 'Try something else!',
      supportive: 'Change topic',
      focused: 'Switch topic',
    },
    [RecoveryAction.SHOW_SOLUTION]: {
      playful: 'Show answer!',
      supportive: 'See solution',
      focused: 'View solution',
    },
    [RecoveryAction.HUMAN_HELP]: {
      playful: 'Ask teacher!',
      supportive: 'Get help',
      focused: 'Request assistance',
    },
    [RecoveryAction.ENCOURAGE]: {
      playful: 'Keep going!',
      supportive: 'Continue',
      focused: 'Continue',
    },
  };
  
  return texts[action]?.[config.messageTone] || 'Continue';
}

/**
 * Get secondary option text.
 */
function getSecondaryOptionText(
  action: RecoveryAction,
  config: GradeRecoveryConfig
): string {
  const texts: Record<RecoveryAction, string> = {
    [RecoveryAction.SIMPLER_EXPLANATION]: 'Or try a different way',
    [RecoveryAction.ALTERNATE_EXAMPLE]: 'Or see another example',
    [RecoveryAction.SUGGEST_REVISION]: 'Or continue without review',
    [RecoveryAction.BREAK_DOWN_STEPS]: 'Or try on my own',
    [RecoveryAction.EASIER_PRACTICE]: 'Or keep trying this one',
    [RecoveryAction.VISUAL_AID]: 'Or skip visual',
    [RecoveryAction.SUGGEST_BREAK]: 'Or keep going',
    [RecoveryAction.SWITCH_TOPIC]: 'Or stay on topic',
    [RecoveryAction.SHOW_SOLUTION]: 'Or try again first',
    [RecoveryAction.HUMAN_HELP]: 'Or try AI help again',
    [RecoveryAction.ENCOURAGE]: 'Or take a break',
  };
  
  return texts[action] || 'Or continue';
}

/**
 * Estimate recovery time in seconds.
 */
function estimateRecoveryTime(action: RecoveryAction): number {
  const times: Record<RecoveryAction, number> = {
    [RecoveryAction.SIMPLER_EXPLANATION]: 120,
    [RecoveryAction.ALTERNATE_EXAMPLE]: 90,
    [RecoveryAction.SUGGEST_REVISION]: 300,
    [RecoveryAction.BREAK_DOWN_STEPS]: 180,
    [RecoveryAction.EASIER_PRACTICE]: 240,
    [RecoveryAction.VISUAL_AID]: 60,
    [RecoveryAction.SUGGEST_BREAK]: 300,
    [RecoveryAction.SWITCH_TOPIC]: 60,
    [RecoveryAction.SHOW_SOLUTION]: 120,
    [RecoveryAction.HUMAN_HELP]: 600,
    [RecoveryAction.ENCOURAGE]: 30,
  };
  
  return times[action] || 120;
}
