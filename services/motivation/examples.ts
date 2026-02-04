/**
 * FILE OBJECTIVE:
 * - Example motivation messages for Grades 2, 6, and 9.
 * - Demonstrates grade-appropriate tone and content.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/motivation/examples.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created motivation examples
 */

import {
  generateMotivationMessage,
  detectMotivationSignals,
} from './generator';
import {
  MotivationTrigger,
  type LearningAnalytics,
  type MotivationMessage,
} from './schemas';

// ============================================================================
// GRADE 2 EXAMPLE (Junior - Playful Tone)
// ============================================================================

/**
 * Example: Grade 2 student who completed a practice session.
 */
export function exampleGrade2Student(): {
  analytics: LearningAnalytics;
  message: MotivationMessage;
  explanation: string;
} {
  const analytics: LearningAnalytics = {
    grade: 2,
    language: 'en',
    currentSession: {
      durationMinutes: 15,
      conceptsCovered: 2,
      questionsAttempted: 8,
      questionsCorrect: 6,
      doubtsAsked: 1,
      hintsUsed: 3,
      completedPlannedActivity: true,
    },
    history: {
      totalSessions: 12,
      currentStreak: 4,
      recentAccuracy: 0.72,
      accuracyTrend: 0.03, // Small improvement
      avgSessionDuration: 12,
      daysSinceLastSession: 1,
    },
    confidence: {
      current: 0.65,
      trend: 0.05,
    },
  };
  
  const message = generateMotivationMessage(analytics, MotivationTrigger.SESSION_END);
  
  return {
    analytics,
    message,
    explanation: `
📚 GRADE 2 MOTIVATION EXAMPLE
=============================

Student Profile:
- Grade 2 (Junior band)
- 4-day learning streak
- Completed 8 questions, got 6 correct
- Used some hints (normal for this age)

Expected Message Characteristics:
- PLAYFUL tone with emojis
- Focus on EFFORT (not accuracy numbers)
- Simple, short sentences
- Never mentions comparison
- Celebrates trying, not just succeeding

Generated Message:
- Focus: ${message.focus}
- Tone: ${message.tone}
- Message: "${message.primaryMessage}"
- Emoji: ${message.emoji || 'none'}
    `.trim(),
  };
}

// ============================================================================
// GRADE 6 EXAMPLE (Middle - Supportive Tone)
// ============================================================================

/**
 * Example: Grade 6 student showing improvement.
 */
export function exampleGrade6Student(): {
  analytics: LearningAnalytics;
  message: MotivationMessage;
  explanation: string;
} {
  const analytics: LearningAnalytics = {
    grade: 6,
    language: 'en',
    currentSession: {
      durationMinutes: 25,
      conceptsCovered: 3,
      questionsAttempted: 12,
      questionsCorrect: 10,
      doubtsAsked: 2,
      hintsUsed: 1,
      completedPlannedActivity: true,
    },
    history: {
      totalSessions: 28,
      currentStreak: 7, // Week streak!
      recentAccuracy: 0.78,
      accuracyTrend: 0.08, // Good improvement
      avgSessionDuration: 22,
      daysSinceLastSession: 1,
    },
    confidence: {
      current: 0.75,
      trend: 0.10,
    },
  };
  
  const message = generateMotivationMessage(analytics, MotivationTrigger.SESSION_END);
  const signals = detectMotivationSignals(analytics);
  
  return {
    analytics,
    message,
    explanation: `
📚 GRADE 6 MOTIVATION EXAMPLE
=============================

Student Profile:
- Grade 6 (Middle band)
- 7-day streak (milestone!)
- 83% accuracy this session
- Showing 8% improvement trend

Detected Signals (ranked):
${signals.map((s, i) => `${i + 1}. ${s.focus} (strength: ${s.strength.toFixed(2)}) - ${s.reason}`).join('\n')}

Expected Message Characteristics:
- SUPPORTIVE tone (may have emoji)
- Focus on CONSISTENCY or IMPROVEMENT
- Acknowledges effort AND progress
- Slightly longer, more meaningful

Generated Message:
- Focus: ${message.focus}
- Tone: ${message.tone}
- Primary: "${message.primaryMessage}"
- Secondary: "${message.secondaryMessage || 'none'}"
- Achievement: ${message.achievement ? `${message.achievement.type}: ${message.achievement.value}` : 'none'}
    `.trim(),
  };
}

// ============================================================================
// GRADE 9 EXAMPLE (Senior - Respectful Tone)
// ============================================================================

/**
 * Example: Grade 9 student who persevered through difficulty.
 */
export function exampleGrade9Student(): {
  analytics: LearningAnalytics;
  message: MotivationMessage;
  explanation: string;
} {
  const analytics: LearningAnalytics = {
    grade: 9,
    language: 'en',
    currentSession: {
      durationMinutes: 40,
      conceptsCovered: 2, // Fewer but deeper
      questionsAttempted: 10,
      questionsCorrect: 7,
      doubtsAsked: 4, // Many questions - curious
      hintsUsed: 5, // Used hints but pushed through
      completedPlannedActivity: true,
    },
    history: {
      totalSessions: 45,
      currentStreak: 3,
      recentAccuracy: 0.65,
      accuracyTrend: 0.02, // Small improvement
      avgSessionDuration: 35,
      daysSinceLastSession: 1,
    },
    confidence: {
      current: 0.58,
      trend: -0.02, // Slight dip (hard topic)
    },
  };
  
  const message = generateMotivationMessage(analytics, MotivationTrigger.SESSION_END);
  const signals = detectMotivationSignals(analytics);
  
  return {
    analytics,
    message,
    explanation: `
📚 GRADE 9 MOTIVATION EXAMPLE
=============================

Student Profile:
- Grade 9 (Senior band)
- Tackled difficult content (5 hints used)
- Asked 4 doubts (high curiosity)
- Confidence slightly down (hard topic)
- BUT completed everything and got 7/10

Detected Signals (ranked):
${signals.map((s, i) => `${i + 1}. ${s.focus} (strength: ${s.strength.toFixed(2)}) - ${s.reason}`).join('\n')}

Expected Message Characteristics:
- RESPECTFUL tone (no emojis)
- Focus on PERSEVERANCE or CURIOSITY
- Acknowledges the struggle was worth it
- More mature, professional language
- Longer, thoughtful message

Generated Message:
- Focus: ${message.focus}
- Tone: ${message.tone}
- Primary: "${message.primaryMessage}"
- Secondary: "${message.secondaryMessage || 'none'}"
- Suggested Action: ${message.suggestedAction ? `${message.suggestedAction.label} (${message.suggestedAction.actionType})` : 'none'}
    `.trim(),
  };
}

// ============================================================================
// STRUGGLING STUDENT EXAMPLE
// ============================================================================

/**
 * Example: Student who is struggling (support scenario).
 */
export function exampleStrugglingStudent(): {
  analytics: LearningAnalytics;
  message: MotivationMessage;
  explanation: string;
} {
  const analytics: LearningAnalytics = {
    grade: 5,
    language: 'en',
    currentSession: {
      durationMinutes: 20,
      conceptsCovered: 1,
      questionsAttempted: 8,
      questionsCorrect: 3, // Only 37.5% accuracy
      doubtsAsked: 3,
      hintsUsed: 6, // Many hints
      completedPlannedActivity: false, // Didn't finish
    },
    history: {
      totalSessions: 15,
      currentStreak: 2,
      recentAccuracy: 0.55,
      accuracyTrend: -0.05, // Declining
      avgSessionDuration: 18,
      daysSinceLastSession: 1,
    },
    confidence: {
      current: 0.40,
      trend: -0.10, // Confidence dropping
    },
  };
  
  const message = generateMotivationMessage(analytics, MotivationTrigger.STRUGGLE_SUPPORT);
  
  return {
    analytics,
    message,
    explanation: `
📚 STRUGGLING STUDENT EXAMPLE
==============================

Student Profile:
- Grade 5 (Middle band)
- Only 37.5% accuracy this session
- Confidence is LOW and dropping
- Used many hints, didn't finish

Key Insight:
Even with poor performance metrics, the message:
- NEVER mentions low accuracy
- NEVER compares to others or past self negatively
- STILL finds something positive (effort, showing up, asking questions)
- Encourages without false praise

Generated Message:
- Focus: ${message.focus}
- Message: "${message.primaryMessage}"

This message focuses on EFFORT (showing up, trying) rather than results.
    `.trim(),
  };
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

/**
 * Run all motivation examples and return formatted output.
 */
export function runAllMotivationExamples(): string {
  const grade2 = exampleGrade2Student();
  const grade6 = exampleGrade6Student();
  const grade9 = exampleGrade9Student();
  const struggling = exampleStrugglingStudent();
  
  return `
${'='.repeat(60)}
MOTIVATION SIGNAL ENGINE - EXAMPLE OUTPUT
${'='.repeat(60)}

${grade2.explanation}

${'─'.repeat(60)}

${grade6.explanation}

${'─'.repeat(60)}

${grade9.explanation}

${'─'.repeat(60)}

${struggling.explanation}

${'='.repeat(60)}
KEY PRINCIPLES DEMONSTRATED:
- Never competitive (no ranks, no comparisons)
- Age-appropriate tone and language
- Focus on effort, not just outcomes
- Support even during struggles
- Celebrate showing up and trying
${'='.repeat(60)}
  `.trim();
}
