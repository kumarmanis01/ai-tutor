/**
 * FILE OBJECTIVE:
 * - Compatibility route so `/parent/progress/[studentId]` resolves.
 * - Re-exports the canonical progress page at `app/(parent)/progress/[studentId]`.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/parent/progress-compat.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | add compatibility re-export for parent progress route
 */

export { default } from '@/app/(parent)/progress/[studentId]/page';
