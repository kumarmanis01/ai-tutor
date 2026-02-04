/**
 * FILE OBJECTIVE:
 * - Export all first-week journey components for easy imports.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Onboarding/FirstWeekJourney/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-05T00:00:00Z | copilot | created index exports
 */

export { FirstWeekProgress } from './FirstWeekProgress';
export { DayProgressCard } from './DayProgressCard';
export { StreakCelebration } from './StreakCelebration';
export { DailyMilestone } from './DailyMilestone';
export { ParentMessagePreview } from './ParentMessagePreview';
export type { DayStatus, FirstWeekProgressProps, DayProgressCardProps } from './types';
