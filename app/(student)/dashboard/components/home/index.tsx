/**
 * FILE OBJECTIVE:
 * - Barrel export for all Home tab components.
 * - Provides unified import for HomeTab composition.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/dashboard/components/home/index.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created barrel export for home components
 * - 2026-02-04 | claude | added HomeTab export
 */
export { HomeTab } from './HomeTab';
export { StudentGreeting } from './StudentGreeting';
export { RecoveryBanner } from './RecoveryBanner';
export { TodaysLearningCard } from './TodaysLearningCard';
export { ContinueWhereLeftOff } from './ContinueWhereLeftOff';
export { WeeklyProgressSnapshot } from './WeeklyProgressSnapshot';
