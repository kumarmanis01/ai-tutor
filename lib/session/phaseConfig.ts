/**
 * FILE OBJECTIVE:
 * - Client-safe phase metadata. Zero server-side imports.
 * - Single source of truth for phase order, labels, icons, and CTA copy.
 * - Importable by both client components and lib utilities.
 *
 * NOTE: Server-side phase metadata lives in sessionEngine.ts (PHASE_METADATA).
 * This file extends it with UI-specific config (icons, CTA text) without
 * importing prisma or any server-only module.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Architecture refactor
 */

export type SessionPhaseClient =
  | 'OVERVIEW'
  | 'EXPLANATION'
  | 'PRACTICE'
  | 'TEST'
  | 'HOMEWORK'
  | 'COMPLETE'
  | 'EXPIRED';

/** Ordered list of displayable phases (excludes COMPLETE and EXPIRED). */
export const PHASE_ORDER: SessionPhaseClient[] = [
  'OVERVIEW',
  'EXPLANATION',
  'PRACTICE',
  'TEST',
  'HOMEWORK',
];

export interface PhaseUIConfig {
  label: string;
  icon: string;
  instruction: string;
  /** Text for the primary "advance" button in that phase. */
  ctaLabel: string;
  /** Short micro-progress message shown at the bottom of a completed phase. */
  completionNote: string;
}

export const PHASE_UI_CONFIG: Record<SessionPhaseClient, PhaseUIConfig> = {
  OVERVIEW: {
    label: 'Overview',
    icon: '👁',
    instruction: 'Review the topic summary and learning objectives.',
    ctaLabel: 'Start Learning',
    completionNote: '✓ Overview read -- starting lesson',
  },
  EXPLANATION: {
    label: 'Learn',
    icon: '📖',
    instruction: 'Read through the topic explanation and key concepts.',
    ctaLabel: 'Continue to Practice',
    completionNote: '✓ Explanation complete -- next: Practice',
  },
  PRACTICE: {
    label: 'Practice',
    icon: '🎯',
    instruction: 'Answer practice questions to reinforce what you learned.',
    ctaLabel: 'Continue to Quick Test',
    completionNote: '✓ Practice complete -- next: Quick Test',
  },
  TEST: {
    label: 'Quick Test',
    icon: '📝',
    instruction: 'Take a short test to check your understanding.',
    ctaLabel: 'Continue to Homework',
    completionNote: '✓ Test complete -- next: Homework',
  },
  HOMEWORK: {
    label: 'Homework',
    icon: '📋',
    instruction: 'Complete the homework assignment for this topic.',
    ctaLabel: 'Finish Session',
    completionNote: '✓ Homework assigned',
  },
  COMPLETE: {
    label: 'Complete',
    icon: '🎉',
    instruction: 'You have completed this topic!',
    ctaLabel: 'Back to Dashboard',
    completionNote: '✓ Session complete',
  },
  EXPIRED: {
    label: 'Expired',
    icon: '⏰',
    instruction: 'This session has expired. Start a new session.',
    ctaLabel: 'Start New Session',
    completionNote: '',
  },
};
