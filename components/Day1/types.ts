/**
 * FILE OBJECTIVE:
 * - Type definitions for Day-1 UX components.
 * - Strict typing for safety-critical Day-1 flow.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Day1/types.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | copilot | created Day-1 types
 */

// ============================================================================
// DAY-1 SCREEN TYPES
// ============================================================================

/**
 * Day-1 screen identifiers
 * EXACTLY 4 screens - no more, no less
 */
export enum Day1Screen {
  WELCOME = 'welcome',
  TODAYS_TASK = 'todays_task',
  TASK_COMPLETION = 'task_completion',
  CELEBRATION = 'celebration',
}

/**
 * Day-1 flow state
 */
export interface Day1FlowState {
  readonly currentScreen: Day1Screen;
  readonly studentName: string;
  readonly grade: number;
  readonly taskStarted: boolean;
  readonly taskCompleted: boolean;
  readonly sessionStartTime: string | null;
  readonly sessionEndTime: string | null;
}

/**
 * Welcome screen props
 */
export interface WelcomeScreenProps {
  readonly studentName: string;
  readonly onStart: () => void;
  readonly language: 'en' | 'hi';
}

/**
 * Today's task screen props
 */
export interface TodaysTaskScreenProps {
  readonly task: Day1Task;
  readonly onStartTask: () => void;
  readonly language: 'en' | 'hi';
}

/**
 * Task completion screen props
 */
export interface TaskCompletionScreenProps {
  readonly studentName: string;
  readonly onClose: () => void;
  readonly language: 'en' | 'hi';
}

/**
 * Celebration screen props
 */
export interface CelebrationScreenProps {
  readonly onFinish: () => void;
  readonly language: 'en' | 'hi';
}

// ============================================================================
// DAY-1 TASK TYPES
// ============================================================================

/**
 * Day-1 task definition
 * Deliberately simple - ONE task only
 */
export interface Day1Task {
  readonly taskId: string;
  readonly title: string;
  readonly estimatedMinutes: number;
  readonly example: Day1Example;
  readonly questions: Day1Question[];
}

/**
 * Example shown before questions
 * Critical for confidence building
 */
export interface Day1Example {
  readonly problem: string;
  readonly solution: string;
  readonly explanation: string;
}

/**
 * Day-1 question (very easy)
 */
export interface Day1Question {
  readonly questionId: string;
  readonly text: string;
  readonly options: string[];
  readonly correctIndex: number;
  readonly hint: string;
}

// ============================================================================
// DAY-1 PARENT MESSAGE TYPES
// ============================================================================

/**
 * Parent message for Day-1 completion
 */
export interface Day1ParentMessage {
  readonly childName: string;
  readonly message: string;
  readonly language: 'en' | 'hi';
  readonly timestamp: string;
}

// ============================================================================
// DAY-1 COPY (FROZEN - DO NOT CHANGE)
// ============================================================================

/**
 * Welcome screen copy - Hindi
 */
export const WELCOME_COPY_HI = {
  greeting: (name: string) => `👋 Welcome, ${name}`,
  body: `Aaj sirf 10-15 minute ka kaam hai

Dheere-dheere seekhenge
Galti ho gayi toh koi problem nahi 🙂`,
  cta: '👉 Aaj ka kaam shuru karein',
} as const;

/**
 * Welcome screen copy - English
 */
export const WELCOME_COPY_EN = {
  greeting: (name: string) => `👋 Welcome, ${name}`,
  body: `Today's task is just 10-15 minutes

We'll learn step by step
Making mistakes is totally okay 🙂`,
  cta: "👉 Start today's task",
} as const;

/**
 * Today's task copy - Hindi
 */
export const TODAYS_TASK_COPY_HI = {
  title: '📘 Aaj ka chhota sa kaam',
  subtitle: '⏱️ Lagbhag 10 minute',
  cta: '▶️ Start karein',
} as const;

/**
 * Today's task copy - English
 */
export const TODAYS_TASK_COPY_EN = {
  title: "📘 Today's small task",
  subtitle: '⏱️ About 10 minutes',
  cta: '▶️ Start',
} as const;

/**
 * Task completion copy - Hindi
 */
export const COMPLETION_COPY_HI = {
  header: '✅ Aaj ka kaam ho gaya!',
  message: `Bahut achha!
Aaj aapne seekhne ka step liya 👏`,
  secondary: 'Kal phir 10 minute milenge 🙂',
  cta: 'Finish',
} as const;

/**
 * Task completion copy - English
 */
export const COMPLETION_COPY_EN = {
  header: "✅ Today's task is done!",
  message: `Great job!
You took a step towards learning today 👏`,
  secondary: 'See you tomorrow for 10 more minutes 🙂',
  cta: 'Finish',
} as const;

/**
 * Celebration copy - Hindi
 */
export const CELEBRATION_COPY_HI = {
  title: '🎉 Aaj ka learning complete',
  subtitle: 'Kal milte hain!',
} as const;

/**
 * Celebration copy - English
 */
export const CELEBRATION_COPY_EN = {
  title: "🎉 Today's learning complete",
  subtitle: 'See you tomorrow!',
} as const;

/**
 * Parent message template - Hindi
 */
export const PARENT_MESSAGE_TEMPLATE_HI = (childName: string) => `🙏 Namaste!

Aaj ${childName} ne app par
10 minute ka learning task complete kiya 👍

Bas itna hi kaafi hai shuruaat ke liye.
Dheere-dheere progress dikhega.

- Spinzy AI Tutor`;

/**
 * Parent message template - English
 */
export const PARENT_MESSAGE_TEMPLATE_EN = (childName: string) => `🙏 Hello!

Today ${childName} completed a
10 minute learning task on the app 👍

That's all they need for now.
Progress will show gradually.

- Spinzy AI Tutor`;

// ============================================================================
// DAY-1 HARD RULES (DO NOT VIOLATE)
// ============================================================================

/**
 * Day-1 hard constraints
 * These are NON-NEGOTIABLE
 */
export const DAY1_RULES = {
  /** Maximum session time in minutes */
  MAX_SESSION_MINUTES: 15,
  /** Minimum session time in minutes */
  MIN_SESSION_MINUTES: 8,
  /** Difficulty offset from grade (MUST be -2 or lower) */
  DIFFICULTY_OFFSET: -2,
  /** Maximum number of questions */
  MAX_QUESTIONS: 3,
  /** Animation duration in milliseconds */
  CELEBRATION_ANIMATION_MS: 2000,
  /** Screens count - exactly 4 */
  TOTAL_SCREENS: 4,
} as const;

/**
 * Day-1 DO NOT list - these features are BANNED
 */
export const DAY1_BANNED_FEATURES = [
  'syllabus_view',
  'dashboard',
  'difficulty_labels',
  'leaderboards',
  'streak_pressure',
  'assessment_language',
  'percentage_scores',
  'correct_incorrect_count',
  'comparison_with_others',
] as const;

export type Day1BannedFeature = (typeof DAY1_BANNED_FEATURES)[number];
