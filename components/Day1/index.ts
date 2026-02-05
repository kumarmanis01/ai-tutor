/**
 * FILE OBJECTIVE:
 * - Barrel export for Day-1 components.
 * - Exposes EXACTLY 4 screens and supporting types.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Day1/index.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | copilot | created barrel export
 */

// Types
export * from './types';

// Screens (EXACTLY 4)
// Re-export with explicit tsx extension for Jest compatibility
export { WelcomeScreen } from './WelcomeScreen';
export { TodaysTaskScreen } from './TodaysTaskScreen';
export { TaskCompletionScreen } from './TaskCompletionScreen';
export { CelebrationScreen } from './CelebrationScreen';
