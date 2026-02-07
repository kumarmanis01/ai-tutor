/**
 * FILE OBJECTIVE:
 * - Type definitions for first-week journey UI components.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Onboarding/FirstWeekJourney/types.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-05T00:00:00Z | copilot | created type definitions
 */

// ============================================================================
// DAY STATUS
// ============================================================================

/**
 * Status of a day in the first-week journey
 */
export type DayStatus = 'locked' | 'current' | 'completed' | 'missed';

/**
 * Day configuration for UI display
 */
export interface DayUIConfig {
  readonly dayNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly title: string;
  readonly description: string;
  readonly emoji: string;
  readonly theme: string;
  readonly status: DayStatus;
  readonly tasksCompleted: number;
  readonly totalTasks: number;
  readonly unlockTime?: Date;
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

/**
 * Props for FirstWeekProgress component
 */
export interface FirstWeekProgressProps {
  /** Student ID for data fetching */
  readonly studentId: string;
  /** Current day number (1-7) */
  readonly currentDay: number;
  /** Array of day configurations */
  readonly days: readonly DayUIConfig[];
  /** Current streak count */
  readonly streakCount: number;
  /** Whether to show celebration animation */
  readonly showCelebration?: boolean;
  /** Callback when day is clicked */
  readonly onDayClick?: (dayNumber: number) => void;
  /** Language for display */
  readonly language?: 'en' | 'hi';
  /** Custom class name */
  readonly className?: string;
}

/**
 * Props for DayProgressCard component
 */
export interface DayProgressCardProps {
  /** Day configuration */
  readonly day: DayUIConfig;
  /** Whether this is the current active day */
  readonly isActive: boolean;
  /** Callback when card is clicked */
  readonly onClick?: () => void;
  /** Language for display */
  readonly language?: 'en' | 'hi';
  /** Custom class name */
  readonly className?: string;
}

/**
 * Props for StreakCelebration component
 */
export interface StreakCelebrationProps {
  /** Current streak count */
  readonly streakCount: number;
  /** Day just completed */
  readonly dayCompleted: number;
  /** Callback when celebration is dismissed */
  readonly onDismiss?: () => void;
  /** Language for display */
  readonly language?: 'en' | 'hi';
  /** Auto-dismiss after milliseconds (0 = no auto-dismiss) */
  readonly autoDismissMs?: number;
}

/**
 * Props for DailyMilestone component
 */
export interface DailyMilestoneProps {
  /** Milestone title */
  readonly title: string;
  /** Milestone description */
  readonly description: string;
  /** Whether milestone is achieved */
  readonly achieved: boolean;
  /** Progress percentage (0-100) */
  readonly progress: number;
  /** Icon/emoji for milestone */
  readonly icon?: string;
  /** Language for display */
  readonly language?: 'en' | 'hi';
}

/**
 * Props for ParentMessagePreview component
 */
export interface ParentMessagePreviewProps {
  /** Day number for the message */
  readonly dayNumber: 1 | 4 | 7;
  /** Student name to personalize message */
  readonly studentName: string;
  /** Subject being learned */
  readonly subject?: string;
  /** Whether message has been sent */
  readonly sent: boolean;
  /** Scheduled send time */
  readonly scheduledTime?: Date;
  /** Language for display */
  readonly language?: 'en' | 'hi';
}

// ============================================================================
// LOCALIZATION
// ============================================================================

/**
 * Localized strings for first-week journey
 */
export interface FirstWeekStrings {
  readonly dayLabel: string;
  readonly currentDay: string;
  readonly completedDay: string;
  readonly lockedDay: string;
  readonly missedDay: string;
  readonly streakLabel: string;
  readonly tasksLabel: string;
  readonly continueButton: string;
  readonly celebrationTitle: string;
  readonly celebrationSubtitle: string;
  readonly parentMessageTitle: string;
  readonly parentMessageScheduled: string;
  readonly parentMessageSent: string;
}

/**
 * Localized strings by language
 */
export const FIRST_WEEK_STRINGS: Record<'en' | 'hi', FirstWeekStrings> = {
  en: {
    dayLabel: 'Day',
    currentDay: 'Today',
    completedDay: 'Completed',
    lockedDay: 'Coming Soon',
    missedDay: 'Missed',
    streakLabel: 'Day Streak',
    tasksLabel: 'tasks completed',
    continueButton: 'Continue Learning',
    celebrationTitle: 'Amazing!',
    celebrationSubtitle: 'You completed Day',
    parentMessageTitle: 'Parent Update',
    parentMessageScheduled: 'Scheduled for',
    parentMessageSent: 'Sent to parent',
  },
  hi: {
    dayLabel: 'दिन',
    currentDay: 'आज',
    completedDay: 'पूरा हुआ',
    lockedDay: 'जल्द आ रहा है',
    missedDay: 'छूट गया',
    streakLabel: 'दिन की स्ट्रीक',
    tasksLabel: 'टास्क पूरे हुए',
    continueButton: 'पढ़ाई जारी रखें',
    celebrationTitle: 'शानदार!',
    celebrationSubtitle: 'आपने दिन पूरा किया',
    parentMessageTitle: 'माता-पिता अपडेट',
    parentMessageScheduled: 'के लिए निर्धारित',
    parentMessageSent: 'माता-पिता को भेजा गया',
  },
} as const;

// ============================================================================
// DAY THEMES
// ============================================================================

/**
 * Visual theme for each day
 */
export interface DayTheme {
  readonly backgroundColor: string;
  readonly accentColor: string;
  readonly textColor: string;
  readonly borderColor: string;
  readonly completedBadgeColor: string;
}

/**
 * Day themes by day number
 */
export const DAY_THEMES: Record<number, DayTheme> = {
  1: {
    backgroundColor: 'bg-green-50',
    accentColor: 'bg-green-500',
    textColor: 'text-green-800',
    borderColor: 'border-green-200',
    completedBadgeColor: 'bg-green-100',
  },
  2: {
    backgroundColor: 'bg-blue-50',
    accentColor: 'bg-blue-500',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-200',
    completedBadgeColor: 'bg-blue-100',
  },
  3: {
    backgroundColor: 'bg-purple-50',
    accentColor: 'bg-purple-500',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-200',
    completedBadgeColor: 'bg-purple-100',
  },
  4: {
    backgroundColor: 'bg-orange-50',
    accentColor: 'bg-orange-500',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-200',
    completedBadgeColor: 'bg-orange-100',
  },
  5: {
    backgroundColor: 'bg-pink-50',
    accentColor: 'bg-pink-500',
    textColor: 'text-pink-800',
    borderColor: 'border-pink-200',
    completedBadgeColor: 'bg-pink-100',
  },
  6: {
    backgroundColor: 'bg-teal-50',
    accentColor: 'bg-teal-500',
    textColor: 'text-teal-800',
    borderColor: 'border-teal-200',
    completedBadgeColor: 'bg-teal-100',
  },
  7: {
    backgroundColor: 'bg-yellow-50',
    accentColor: 'bg-yellow-500',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-200',
    completedBadgeColor: 'bg-yellow-100',
  },
} as const;
