/**
 * FILE OBJECTIVE:
 * - Type definitions and constants for Day-1 student tasks.
 * - Used by lib/day1/taskGenerator.ts.
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface Day1Example {
  readonly problem: string;
  readonly solution: string;
  readonly explanation: string;
}

export interface Day1Question {
  readonly questionId: string;
  readonly text: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly hint: string;
}

export interface Day1Task {
  readonly taskId: string;
  readonly title: string;
  readonly estimatedMinutes: number;
  readonly example: Day1Example;
  readonly questions: Day1Question[];
}

export interface Day1ParentMessage {
  readonly childName: string;
  readonly message: string;
  readonly language: 'en' | 'hi';
  readonly timestamp: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DAY1_RULES = {
  DIFFICULTY_OFFSET: -2,  // difficulty = grade - 2
  MAX_QUESTIONS: 3,
} as const;

export const PARENT_MESSAGE_TEMPLATE_HI = (childName: string): string =>
  `${childName} ne aaj pehla kadam uthaya -- yeh bahut acchi baat hai. ` +
  `Humne ek chhota sa kaam diya hai. Koi dbaav nahi -- bas shuru karo.`;

export const PARENT_MESSAGE_TEMPLATE_EN = (childName: string): string =>
  `${childName} has taken the first step today -- that is wonderful. ` +
  `We have given a small, easy task to start with. No pressure -- just begin.`;
