/**
 * FILE OBJECTIVE:
 * - First 7-Day Learning Orchestrator for student onboarding.
 * - Ensures every day ends in success.
 * - Difficulty starts BELOW grade level (grade - 2).
 * - No syllabus, no grades, no pressure.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/onboarding/firstWeekOrchestrator.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created first week orchestrator
 */

import type { Grade } from '@/lib/ai/prompts/schemas';

// ============================================================================
// TYPES & ENUMS
// ============================================================================

/**
 * Day number in the first week (1-7)
 */
export type FirstWeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Student emotion target for each day
 */
export enum DayEmotion {
  DAY_1 = 'Yeh toh aata hai', // "I know this"
  DAY_2 = 'Thoda mushkil, par ho gaya', // "A bit hard, but done"
  DAY_3 = 'Samajh aa raha hai', // "I'm understanding"
  DAY_4 = 'Galti theek ho gayi', // "Mistake fixed"
  DAY_5 = 'Ab fast ho raha hai', // "Getting faster now"
  DAY_6 = 'Main kar sakta hoon', // "I can do this"
  DAY_7 = 'Maine 7 din padha!', // "I studied 7 days!"
}

/**
 * Task type for each day
 */
export enum DayTaskType {
  CONFIDENCE_WIN = 'confidence_win',
  GENTLE_STRETCH = 'gentle_stretch',
  PATTERN_RECOGNITION = 'pattern_recognition',
  STRUGGLE_SUPPORT = 'struggle_support',
  VISIBLE_IMPROVEMENT = 'visible_improvement',
  MINI_MASTERY = 'mini_mastery',
  CELEBRATION = 'celebration',
}

/**
 * Daily task configuration
 */
export interface DailyTask {
  /** Day number */
  readonly day: FirstWeekDay;
  /** Task type */
  readonly taskType: DayTaskType;
  /** Target emotion */
  readonly targetEmotion: string;
  /** Difficulty level (1-10 scale, relative to grade) */
  readonly difficultyLevel: number;
  /** Maximum time in minutes */
  readonly maxTimeMinutes: number;
  /** Maximum questions */
  readonly maxQuestions: number;
  /** Maximum wrong answers allowed */
  readonly maxWrongAllowed: number;
  /** Whether hints are enabled */
  readonly hintsEnabled: boolean;
  /** Focus area */
  readonly focusArea: 'familiar' | 'review' | 'new_twist' | 'pattern' | 'recap';
  /** AI behavior rules */
  readonly aiRules: string[];
  /** Success criteria */
  readonly successCriteria: string;
}

/**
 * Parent message configuration
 */
export interface ParentMessage {
  /** Day to send */
  readonly day: FirstWeekDay;
  /** Message type */
  readonly type: 'soft_start' | 'progress_update' | 'celebration';
  /** Message template (Hindi/English) */
  readonly templateHi: string;
  readonly templateEn: string;
  /** Is this message mandatory? */
  readonly mandatory: boolean;
}

/**
 * First week plan for a student
 */
export interface FirstWeekPlan {
  /** Student ID */
  readonly studentId: string;
  /** Student grade */
  readonly grade: Grade;
  /** Subject focus */
  readonly subject: string;
  /** Daily tasks */
  readonly dailyTasks: DailyTask[];
  /** Parent messages */
  readonly parentMessages: ParentMessage[];
  /** Plan created at */
  readonly createdAt: string;
}

/**
 * Daily progress record
 */
export interface DailyProgress {
  /** Day number */
  readonly day: FirstWeekDay;
  /** Completed? */
  readonly completed: boolean;
  /** Time spent (minutes) */
  readonly timeSpent: number;
  /** Questions attempted */
  readonly questionsAttempted: number;
  /** Questions correct */
  readonly questionsCorrect: number;
  /** Hints used */
  readonly hintsUsed: number;
  /** Student showed struggle? */
  readonly showedStruggle: boolean;
  /** Ended with success? */
  readonly endedWithSuccess: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum session time per day (non-negotiable)
 */
export const MAX_DAILY_MINUTES = 15;

/**
 * Day configurations (frozen script)
 */
export const DAY_CONFIGS: Record<FirstWeekDay, Omit<DailyTask, 'day'>> = {
  1: {
    taskType: DayTaskType.CONFIDENCE_WIN,
    targetEmotion: DayEmotion.DAY_1,
    difficultyLevel: -2, // Grade minus 2
    maxTimeMinutes: 10,
    maxQuestions: 5,
    maxWrongAllowed: 0, // Must be 100% completion
    hintsEnabled: true,
    focusArea: 'familiar',
    aiRules: [
      'Start with VERY easy questions',
      'Use familiar concepts only',
      'Provide immediate positive feedback',
      'Never show difficulty indicator',
    ],
    successCriteria: '100% completion with positive reinforcement',
  },
  2: {
    taskType: DayTaskType.GENTLE_STRETCH,
    targetEmotion: DayEmotion.DAY_2,
    difficultyLevel: -1, // Grade minus 1
    maxTimeMinutes: 12,
    maxQuestions: 6,
    maxWrongAllowed: 2,
    hintsEnabled: true,
    focusArea: 'review',
    aiRules: [
      'Same topic as Day 1 with one small twist',
      'Allow up to 2 mistakes gracefully',
      'Celebrate effort, not just correctness',
    ],
    successCriteria: 'Completion with ≤2 mistakes',
  },
  3: {
    taskType: DayTaskType.PATTERN_RECOGNITION,
    targetEmotion: DayEmotion.DAY_3,
    difficultyLevel: -1,
    maxTimeMinutes: 12,
    maxQuestions: 5,
    maxWrongAllowed: 3,
    hintsEnabled: true,
    focusArea: 'pattern',
    aiRules: [
      'Ask student to identify patterns',
      'Accept any reasonable explanation',
      'No penalty for wrong explanations',
      'Focus on understanding, not correctness',
    ],
    successCriteria: 'Student attempts explanation (correctness not required)',
  },
  4: {
    taskType: DayTaskType.STRUGGLE_SUPPORT,
    targetEmotion: DayEmotion.DAY_4,
    difficultyLevel: 0, // At grade level
    maxTimeMinutes: 15,
    maxQuestions: 6,
    maxWrongAllowed: 2,
    hintsEnabled: true,
    focusArea: 'new_twist',
    aiRules: [
      'One mistake is expected and okay',
      'Provide praise before correction',
      'Show worked example after mistake',
      'End on a correct answer',
    ],
    successCriteria: 'Student recovers from mistake with AI support',
  },
  5: {
    taskType: DayTaskType.VISIBLE_IMPROVEMENT,
    targetEmotion: DayEmotion.DAY_5,
    difficultyLevel: -1,
    maxTimeMinutes: 12,
    maxQuestions: 6,
    maxWrongAllowed: 1,
    hintsEnabled: true,
    focusArea: 'review',
    aiRules: [
      'Similar to Day 2 content',
      'Subtly note speed improvement',
      'Reinforce pattern recognition',
      'Celebrate progress',
    ],
    successCriteria: 'Faster completion than Day 2',
  },
  6: {
    taskType: DayTaskType.MINI_MASTERY,
    targetEmotion: DayEmotion.DAY_6,
    difficultyLevel: 0,
    maxTimeMinutes: 15,
    maxQuestions: 4,
    maxWrongAllowed: 1,
    hintsEnabled: true,
    focusArea: 'pattern',
    aiRules: [
      'Present 3-step problems',
      'Hints allowed and encouraged',
      'Build confidence in multi-step thinking',
      'Celebrate completion',
    ],
    successCriteria: 'Complete 3-step problem with or without hints',
  },
  7: {
    taskType: DayTaskType.CELEBRATION,
    targetEmotion: DayEmotion.DAY_7,
    difficultyLevel: -2, // Easy recap
    maxTimeMinutes: 10,
    maxQuestions: 5,
    maxWrongAllowed: 1,
    hintsEnabled: true,
    focusArea: 'recap',
    aiRules: [
      'Easy recap of the week',
      'Show streak and praise',
      'Trigger parent celebration message',
      'End with "You did it!" moment',
    ],
    successCriteria: 'Celebration and streak acknowledgment',
  },
};

/**
 * Parent message templates
 */
export const PARENT_MESSAGES: ParentMessage[] = [
  {
    day: 1,
    type: 'soft_start',
    templateHi: '🙏 Namaste! Aaj se {studentName} ki learning journey shuru hui hai. Hum unke saath hain.',
    templateEn: '🙏 Hello! {studentName}\'s learning journey has started today. We\'re here to help.',
    mandatory: false,
  },
  {
    day: 4,
    type: 'progress_update',
    templateHi: '📚 {studentName} regular padh raha hai aur concepts samajh aa rahe hain. {completionRate}% tasks complete! 💪',
    templateEn: '📚 {studentName} is studying regularly and understanding concepts. {completionRate}% tasks complete! 💪',
    mandatory: true,
  },
  {
    day: 7,
    type: 'celebration',
    templateHi: '🎉 Badhai ho! {studentName} ne 7 din continuous padhai ki! 🌟 Streak: {streakDays} days. Improvement: {improvementPercent}%',
    templateEn: '🎉 Congratulations! {studentName} studied for 7 continuous days! 🌟 Streak: {streakDays} days. Improvement: {improvementPercent}%',
    mandatory: true,
  },
];

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Calculate effective difficulty for a day
 * Rule: Difficulty = grade + difficultyLevel (where level is -2 to 0)
 * Minimum difficulty is always 1 (Grade 1 easy)
 */
export function calculateEffectiveDifficulty(grade: Grade, dayConfig: DailyTask): number {
  const baseDifficulty = grade + dayConfig.difficultyLevel;
  return Math.max(1, baseDifficulty);
}

/**
 * Create first week plan for a student
 */
export function createFirstWeekPlan(
  studentId: string,
  grade: Grade,
  subject: string
): FirstWeekPlan {
  const dailyTasks: DailyTask[] = [];
  
  for (let day = 1; day <= 7; day++) {
    const config = DAY_CONFIGS[day as FirstWeekDay];
    dailyTasks.push({
      day: day as FirstWeekDay,
      ...config,
    });
  }
  
  return {
    studentId,
    grade,
    subject,
    dailyTasks,
    parentMessages: PARENT_MESSAGES,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get task for a specific day
 */
export function getDailyTask(plan: FirstWeekPlan, day: FirstWeekDay): DailyTask {
  const task = plan.dailyTasks.find(t => t.day === day);
  if (!task) {
    throw new Error(`No task found for day ${day}`);
  }
  return task;
}

/**
 * Check if day should trigger parent message
 */
export function shouldSendParentMessage(day: FirstWeekDay): ParentMessage | null {
  return PARENT_MESSAGES.find(m => m.day === day) || null;
}

/**
 * Format parent message with student data
 */
export function formatParentMessage(
  message: ParentMessage,
  data: {
    studentName: string;
    completionRate?: number;
    streakDays?: number;
    improvementPercent?: number;
  },
  language: 'hi' | 'en' = 'hi'
): string {
  const template = language === 'hi' ? message.templateHi : message.templateEn;
  
  return template
    .replace('{studentName}', data.studentName)
    .replace('{completionRate}', String(data.completionRate || 0))
    .replace('{streakDays}', String(data.streakDays || 0))
    .replace('{improvementPercent}', String(data.improvementPercent || 0));
}

/**
 * Validate daily progress meets success criteria
 */
export function validateDaySuccess(
  day: FirstWeekDay,
  progress: DailyProgress
): { success: boolean; reason: string } {
  const config = DAY_CONFIGS[day];
  
  // Rule: Every day must end in success
  if (!progress.endedWithSuccess) {
    return { success: false, reason: 'Day did not end with success moment' };
  }
  
  // Check time limit
  if (progress.timeSpent > config.maxTimeMinutes) {
    // This is a warning, not failure - we prioritize completion
    // But log it for monitoring
  }
  
  // Check wrong answers within limit
  const wrongAnswers = progress.questionsAttempted - progress.questionsCorrect;
  if (wrongAnswers > config.maxWrongAllowed) {
    // AI should have intervened - log this as system issue
    return { 
      success: true, // Still count as success if completed
      reason: 'Completed with extra mistakes - AI intervention needed' 
    };
  }
  
  return { success: true, reason: 'Day completed successfully' };
}

/**
 * Calculate improvement percentage between two days
 */
export function calculateImprovement(
  day2Progress: DailyProgress,
  day5Progress: DailyProgress
): number {
  // Compare accuracy
  const day2Accuracy = day2Progress.questionsCorrect / day2Progress.questionsAttempted;
  const day5Accuracy = day5Progress.questionsCorrect / day5Progress.questionsAttempted;
  
  // Compare speed (questions per minute)
  const day2Speed = day2Progress.questionsAttempted / day2Progress.timeSpent;
  const day5Speed = day5Progress.questionsAttempted / day5Progress.timeSpent;
  
  // Weighted improvement (accuracy 60%, speed 40%)
  const accuracyImprovement = (day5Accuracy - day2Accuracy) * 0.6;
  const speedImprovement = ((day5Speed - day2Speed) / day2Speed) * 0.4;
  
  return Math.round((accuracyImprovement + speedImprovement) * 100);
}

/**
 * Check if student is ready for Day 7 celebration
 */
export function isReadyForCelebration(
  progressHistory: DailyProgress[]
): { ready: boolean; streakDays: number; completionRate: number } {
  const completedDays = progressHistory.filter(p => p.completed).length;
  const totalDays = progressHistory.length;
  const completionRate = Math.round((completedDays / totalDays) * 100);
  
  // Calculate streak (consecutive completed days)
  let streakDays = 0;
  for (let i = progressHistory.length - 1; i >= 0; i--) {
    if (progressHistory[i].completed) {
      streakDays++;
    } else {
      break;
    }
  }
  
  // Ready for celebration if completed at least 5 of 6 days
  const ready = completedDays >= 5;
  
  return { ready, streakDays, completionRate };
}

/**
 * Get AI behavior rules for a specific day
 */
export function getAIRulesForDay(day: FirstWeekDay): string[] {
  const baseRules = [
    'Never show full syllabus',
    'Never show grades or ranks',
    'Never create pressure',
    'Session must end with success',
    `Maximum ${MAX_DAILY_MINUTES} minutes`,
  ];
  
  const dayRules = DAY_CONFIGS[day].aiRules;
  
  return [...baseRules, ...dayRules];
}

/**
 * Determine if AI should intervene (student struggling)
 */
export function shouldAIIntervene(
  consecutiveWrong: number,
  timeOnCurrentQuestion: number,
  averageTimePerQuestion: number
): { shouldIntervene: boolean; reason: string; action: string } {
  // Rule: 2 wrong answers in a row = intervene
  if (consecutiveWrong >= 2) {
    return {
      shouldIntervene: true,
      reason: 'consecutive_failures',
      action: 'reduce_difficulty',
    };
  }
  
  // Rule: Taking too long (2x average time)
  if (timeOnCurrentQuestion > averageTimePerQuestion * 2) {
    return {
      shouldIntervene: true,
      reason: 'time_struggle',
      action: 'show_hint',
    };
  }
  
  return {
    shouldIntervene: false,
    reason: 'none',
    action: 'continue',
  };
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

export const FirstWeekOrchestrator = {
  createFirstWeekPlan,
  getDailyTask,
  calculateEffectiveDifficulty,
  shouldSendParentMessage,
  formatParentMessage,
  validateDaySuccess,
  calculateImprovement,
  isReadyForCelebration,
  getAIRulesForDay,
  shouldAIIntervene,
  DAY_CONFIGS,
  PARENT_MESSAGES,
  MAX_DAILY_MINUTES,
};
