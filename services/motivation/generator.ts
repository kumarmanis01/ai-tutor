/**
 * FILE OBJECTIVE:
 * - Generate effort-focused motivation signals from learning analytics.
 * - Never competitive, always encouraging.
 * - Grade and language aware.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/motivation/generator.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created motivation generator
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MotivationFocus,
  MotivationTone,
  MotivationTrigger,
  getMotivationConfig,
  type LearningAnalytics,
  type MotivationMessage,
  type GradeMotivationConfig,
} from './schemas';

// ============================================================================
// SIGNAL DETECTION
// ============================================================================

interface MotivationSignal {
  focus: MotivationFocus;
  strength: number; // 0-1, higher = more relevant
  reason: string;
}

/**
 * Analyze learning analytics to detect motivation signals.
 * Returns ranked list of applicable motivation focuses.
 */
export function detectMotivationSignals(analytics: LearningAnalytics): MotivationSignal[] {
  const signals: MotivationSignal[] = [];
  const { currentSession, history, confidence } = analytics;
  
  // IMPROVEMENT: Check if student improved accuracy
  if (history.accuracyTrend > 0.05) {
    signals.push({
      focus: MotivationFocus.IMPROVEMENT,
      strength: Math.min(history.accuracyTrend * 5, 1), // 20% improvement = max strength
      reason: `Accuracy improved by ${Math.round(history.accuracyTrend * 100)}%`,
    });
  }
  
  // EFFORT: Check session engagement
  if (currentSession.questionsAttempted >= 5 || currentSession.durationMinutes >= 15) {
    const effortScore = Math.min(
      (currentSession.questionsAttempted / 10) * 0.5 +
      (currentSession.durationMinutes / 30) * 0.5,
      1
    );
    signals.push({
      focus: MotivationFocus.EFFORT,
      strength: effortScore,
      reason: `Attempted ${currentSession.questionsAttempted} questions in ${currentSession.durationMinutes} minutes`,
    });
  }
  
  // CONSISTENCY: Check learning streak
  if (history.currentStreak >= 3) {
    signals.push({
      focus: MotivationFocus.CONSISTENCY,
      strength: Math.min(history.currentStreak / 7, 1), // 7-day streak = max
      reason: `${history.currentStreak}-day learning streak`,
    });
  }
  
  // PERSEVERANCE: Overcame difficulty (used hints but got correct)
  if (currentSession.hintsUsed > 0 && currentSession.questionsCorrect > 0) {
    const perseveranceScore = Math.min(
      (currentSession.questionsCorrect / Math.max(currentSession.hintsUsed, 1)) * 0.5,
      1
    );
    signals.push({
      focus: MotivationFocus.PERSEVERANCE,
      strength: perseveranceScore,
      reason: `Used ${currentSession.hintsUsed} hints and answered ${currentSession.questionsCorrect} correctly`,
    });
  }
  
  // CURIOSITY: Asked doubts
  if (currentSession.doubtsAsked >= 2) {
    signals.push({
      focus: MotivationFocus.CURIOSITY,
      strength: Math.min(currentSession.doubtsAsked / 5, 1),
      reason: `Asked ${currentSession.doubtsAsked} questions`,
    });
  }
  
  // THOROUGHNESS: Completed planned activity
  if (currentSession.completedPlannedActivity) {
    signals.push({
      focus: MotivationFocus.THOROUGHNESS,
      strength: 0.8,
      reason: 'Completed planned learning activity',
    });
  }
  
  // COMPLETION: Always applicable as fallback
  if (currentSession.durationMinutes > 0) {
    signals.push({
      focus: MotivationFocus.COMPLETION,
      strength: 0.3, // Low priority fallback
      reason: 'Completed a learning session',
    });
  }
  
  // Sort by strength (highest first)
  return signals.sort((a, b) => b.strength - a.strength);
}

/**
 * Select the best motivation focus for this student.
 */
export function selectBestFocus(
  signals: MotivationSignal[],
  config: GradeMotivationConfig
): MotivationSignal {
  // Filter out avoided focuses
  const eligibleSignals = signals.filter(
    s => !config.avoidFocuses.includes(s.focus)
  );
  
  // Prefer configured focuses
  const preferredSignals = eligibleSignals.filter(
    s => config.preferredFocuses.includes(s.focus)
  );
  
  // Return best preferred, or best eligible, or completion fallback
  return preferredSignals[0] || eligibleSignals[0] || {
    focus: MotivationFocus.COMPLETION,
    strength: 0.3,
    reason: 'Session completed',
  };
}

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

interface MessageTemplate {
  primary: string;
  secondary?: string;
  emoji?: string;
}

/**
 * Get message templates by focus and tone.
 */
function getMessageTemplates(
  focus: MotivationFocus,
  tone: MotivationTone,
  analytics: LearningAnalytics
): MessageTemplate[] {
  const templates: Record<MotivationFocus, Record<MotivationTone, MessageTemplate[]>> = {
    [MotivationFocus.IMPROVEMENT]: {
      [MotivationTone.PLAYFUL]: [
        { primary: "Wow! You're getting better and better!", emoji: '🌟', secondary: "Keep going, superstar!" },
        { primary: "Look at you go! You learned so much today!", emoji: '🚀' },
      ],
      [MotivationTone.SUPPORTIVE]: [
        { primary: "Great progress! Your hard work is paying off.", secondary: "You're understanding more each day." },
        { primary: "You've improved since last time! That's what learning looks like.", emoji: '📈' },
      ],
      [MotivationTone.RESPECTFUL]: [
        { primary: "Your accuracy has improved. Consistent effort leads to consistent growth." },
        { primary: "You're building real understanding. Keep up the focused practice." },
      ],
    },
    [MotivationFocus.EFFORT]: {
      [MotivationTone.PLAYFUL]: [
        { primary: "You worked so hard today!", emoji: '💪', secondary: "That's awesome!" },
        { primary: "Look at all the practice you did!", emoji: '⭐' },
      ],
      [MotivationTone.SUPPORTIVE]: [
        { primary: "You put in real effort today. That's what matters most.", secondary: "Learning happens through practice." },
        { primary: "Great work ethic! Every question you try makes you stronger." },
      ],
      [MotivationTone.RESPECTFUL]: [
        { primary: "Solid effort today. Deep practice builds lasting understanding." },
        { primary: "You invested quality time in learning. That commitment matters." },
      ],
    },
    [MotivationFocus.CONSISTENCY]: {
      [MotivationTone.PLAYFUL]: [
        { primary: `${analytics.history.currentStreak} days in a row! Amazing!`, emoji: '🔥' },
        { primary: "You keep coming back to learn! That's super cool!", emoji: '🌈' },
      ],
      [MotivationTone.SUPPORTIVE]: [
        { primary: `${analytics.history.currentStreak}-day streak! Consistency is your superpower.`, emoji: '🔥' },
        { primary: "You're building a great learning habit. Keep it going!" },
      ],
      [MotivationTone.RESPECTFUL]: [
        { primary: `${analytics.history.currentStreak} consecutive days of learning. Discipline creates results.` },
        { primary: "Your consistency shows commitment. That's how expertise is built." },
      ],
    },
    [MotivationFocus.PERSEVERANCE]: {
      [MotivationTone.PLAYFUL]: [
        { primary: "You didn't give up! You're a problem-solving hero!", emoji: '🦸' },
        { primary: "You kept trying until you got it! So proud of you!", emoji: '🎉' },
      ],
      [MotivationTone.SUPPORTIVE]: [
        { primary: "You stuck with it even when it was hard. That takes courage.", secondary: "The best learners don't give up." },
        { primary: "You asked for help and kept going. That's real strength." },
      ],
      [MotivationTone.RESPECTFUL]: [
        { primary: "You persevered through difficulty. That resilience will serve you well." },
        { primary: "Challenging problems require patience. You showed both today." },
      ],
    },
    [MotivationFocus.CURIOSITY]: {
      [MotivationTone.PLAYFUL]: [
        { primary: "You asked great questions! Curious minds learn the most!", emoji: '🤔' },
        { primary: "So many good questions! You're a super explorer!", emoji: '🔍' },
      ],
      [MotivationTone.SUPPORTIVE]: [
        { primary: "Your questions show real thinking. Curiosity drives learning.", emoji: '💡' },
        { primary: "Great questions today! Never stop asking 'why'." },
      ],
      [MotivationTone.RESPECTFUL]: [
        { primary: "Thoughtful questions lead to deeper understanding. Keep questioning." },
        { primary: "Your curiosity is an asset. The best thinkers always ask questions." },
      ],
    },
    [MotivationFocus.THOROUGHNESS]: {
      [MotivationTone.PLAYFUL]: [
        { primary: "You finished everything! What a champion!", emoji: '🏆' },
        { primary: "You did it all! High five!", emoji: '✋' },
      ],
      [MotivationTone.SUPPORTIVE]: [
        { primary: "You completed your learning goal. Well done!", secondary: "Finishing what you start is a valuable skill." },
        { primary: "Task complete! You followed through on your plan." },
      ],
      [MotivationTone.RESPECTFUL]: [
        { primary: "You completed your planned session. Execution matters as much as intent." },
        { primary: "Goal achieved. Consistent completion builds momentum." },
      ],
    },
    [MotivationFocus.COMPLETION]: {
      [MotivationTone.PLAYFUL]: [
        { primary: "Yay! You learned something new today!", emoji: '🎈' },
        { primary: "Great job coming to learn today!", emoji: '😊' },
      ],
      [MotivationTone.SUPPORTIVE]: [
        { primary: "Thanks for spending time learning today.", secondary: "Every session counts." },
        { primary: "Another session complete. You're making progress." },
      ],
      [MotivationTone.RESPECTFUL]: [
        { primary: "Session complete. Consistent learning accumulates over time." },
        { primary: "Good work today. See you in the next session." },
      ],
    },
  };
  
  return templates[focus]?.[tone] || templates[MotivationFocus.COMPLETION][tone];
}

// ============================================================================
// MESSAGE GENERATOR
// ============================================================================

/**
 * Generate a motivation message from learning analytics.
 * Returns 1-2 messages per session, never competitive.
 */
export function generateMotivationMessage(
  analytics: LearningAnalytics,
  trigger: MotivationTrigger = MotivationTrigger.SESSION_END
): MotivationMessage {
  const config = getMotivationConfig(analytics.grade);
  
  // Detect applicable motivation signals
  const signals = detectMotivationSignals(analytics);
  
  // Select the best focus for this student
  const selectedSignal = selectBestFocus(signals, config);
  
  // Get message templates
  const templates = getMessageTemplates(selectedSignal.focus, config.tone, analytics);
  
  // Randomly select a template (with variation)
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Build achievement data if applicable
  const achievement = buildAchievement(selectedSignal, analytics);
  
  // Build suggested action
  const suggestedAction = buildSuggestedAction(analytics, trigger);
  
  // Construct the message
  const message: MotivationMessage = {
    id: uuidv4(),
    focus: selectedSignal.focus,
    tone: config.tone,
    trigger,
    primaryMessage: template.primary,
    secondaryMessage: template.secondary,
    emoji: config.useEmojis ? template.emoji : undefined,
    achievement,
    suggestedAction,
    metadata: {
      generatedAt: new Date().toISOString(),
      analyticsSnapshot: {
        sessionDuration: analytics.currentSession.durationMinutes,
        questionsAttempted: analytics.currentSession.questionsAttempted,
        accuracy: analytics.currentSession.questionsAttempted > 0
          ? analytics.currentSession.questionsCorrect / analytics.currentSession.questionsAttempted
          : 0,
        streak: analytics.history.currentStreak,
      },
    },
  };
  
  return message;
}

/**
 * Build achievement data if student achieved something notable.
 */
function buildAchievement(
  signal: MotivationSignal,
  analytics: LearningAnalytics
): MotivationMessage['achievement'] | undefined {
  const { currentSession, history } = analytics;
  
  // Check for personal bests
  if (signal.focus === MotivationFocus.CONSISTENCY && history.currentStreak >= 7) {
    return {
      type: 'streak',
      value: `${history.currentStreak} days`,
      isPersonalBest: true,
    };
  }
  
  if (signal.focus === MotivationFocus.IMPROVEMENT && history.accuracyTrend > 0.1) {
    return {
      type: 'accuracy_improvement',
      value: `+${Math.round(history.accuracyTrend * 100)}%`,
      isPersonalBest: false,
    };
  }
  
  if (signal.focus === MotivationFocus.EFFORT && currentSession.questionsAttempted >= 10) {
    return {
      type: 'practice_volume',
      value: `${currentSession.questionsAttempted} questions`,
      isPersonalBest: false,
    };
  }
  
  return undefined;
}

/**
 * Build suggested next action.
 */
function buildSuggestedAction(
  analytics: LearningAnalytics,
  trigger: MotivationTrigger
): MotivationMessage['suggestedAction'] | undefined {
  const { currentSession, history, confidence } = analytics;
  
  // After long session, suggest rest
  if (currentSession.durationMinutes > 45) {
    return {
      label: 'Take a break',
      actionType: 'rest',
    };
  }
  
  // Low confidence, suggest practice
  if (confidence.current < 0.5) {
    return {
      label: 'Try some practice',
      actionType: 'practice',
    };
  }
  
  // High performance, suggest exploring new topics
  if (currentSession.questionsCorrect / Math.max(currentSession.questionsAttempted, 1) > 0.85) {
    return {
      label: 'Explore new topics',
      actionType: 'explore',
    };
  }
  
  // Default: continue learning
  if (trigger === MotivationTrigger.SESSION_END && currentSession.durationMinutes < 20) {
    return {
      label: 'Keep going',
      actionType: 'continue',
    };
  }
  
  return undefined;
}

// ============================================================================
// LANGUAGE SUPPORT
// ============================================================================

/**
 * Translate motivation message to Hindi.
 * (In production, would use translation service or pre-translated templates)
 */
export function translateToHindi(message: MotivationMessage): MotivationMessage {
  // Simplified translation mapping (production would have full translations)
  const hindiMappings: Record<string, string> = {
    "Wow! You're getting better and better!": "वाह! तुम बेहतर से बेहतर होते जा रहे हो!",
    "You worked so hard today!": "आज तुमने बहुत मेहनत की!",
    "Great progress!": "बहुत अच्छी प्रगति!",
    "Keep going!": "ऐसे ही चलते रहो!",
  };
  
  return {
    ...message,
    primaryMessage: hindiMappings[message.primaryMessage] || message.primaryMessage,
  };
}

/**
 * Translate motivation message to Hinglish.
 */
export function translateToHinglish(message: MotivationMessage): MotivationMessage {
  const hinglishMappings: Record<string, string> = {
    "Wow! You're getting better and better!": "Wow! Tum better se better hote ja rahe ho!",
    "You worked so hard today!": "Aaj tumne bahut hard work kiya!",
    "Great progress!": "Bahut acchi progress!",
    "Keep going!": "Aise hi chalte raho!",
  };
  
  return {
    ...message,
    primaryMessage: hinglishMappings[message.primaryMessage] || message.primaryMessage,
  };
}
