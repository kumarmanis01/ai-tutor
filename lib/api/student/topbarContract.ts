/**
 * FILE OBJECTIVE:
 * - Shared type contract for combined student topbar payload returned by
 *   GET /api/student/topbar-stats and consumed by student topbar UI.
 *
 * LINKED UNIT TEST:
 * - tests/integration/student/topbar-stats.focus.integration.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | create dedicated typed contract for topbar focus API payload
 * - 2026-05-09T00:00:00Z | copilot | expand contract to combined topbar stats + focus response
 * - 2026-05-09T00:00:00Z | copilot | document removal of standalone topbar-focus endpoint after contract consolidation
 */

export type StudentTopbarMode = 'active' | 'exam' | 'weak' | 'recovery';

export interface StudentTopbarFocus {
  readonly mode: StudentTopbarMode;
  readonly focusLabel: string;
  readonly etaLabel: string;
  readonly askLabel: string;
  readonly momentumLabel: string;
  readonly contextTag: string;
  readonly searchPlaceholder: string;
  readonly actionHref: string;
  readonly sourceRuleId: string;
}

// Standalone GET /api/student/topbar-focus has been removed.
// Focus data now ships inside GET /api/student/topbar-stats.
export interface StudentTopbarFocusResponse {
  readonly focus: StudentTopbarFocus;
  readonly generatedAt: string;
}

export interface StudentTopbarStatsResponse extends StudentTopbarFocusResponse {
  readonly streak: number;
  readonly longestStreak: number;
  readonly level: number;
  readonly shieldAvailable: boolean;
  readonly cosmeticUnlocks: string[];
}
