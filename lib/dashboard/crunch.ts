/**
 * FILE OBJECTIVE:
 * - Provide a small pure helper to compute exam countdown and whether dashboard
 *   should enter "crunch mode" (<= 14 days to exam).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/dashboard/crunch.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | added computeCrunchMode helper
 */

export interface CrunchResult {
  examDate: Date | null;
  daysToExam: number | null;
  crunchMode: boolean;
}

/**
 * Compute the examDate (prefer explicit per-user date) and whether crunch
 * mode is active (daysToExam in [0,14]). Returns daysToExam as an integer
 * number of days (ceil), or null when no valid date provided.
 */
export function computeCrunchMode(
  perUserExamDate: Date | string | null | undefined,
  latestPlan?: { examDate?: Date | string | null } | null
): CrunchResult {
  const toDate = (v: unknown): Date | null => {
    if (!v) return null;
    try {
      const d = v instanceof Date ? v : new Date(String(v));
      if (Number.isNaN(d.getTime())) return null;
      return d;
    } catch {
      return null;
    }
  };

  const examDate = toDate(perUserExamDate) ?? toDate(latestPlan?.examDate) ?? null;
  if (!examDate) return { examDate: null, daysToExam: null, crunchMode: false };

  const msPerDay = 86_400_000;
  const days = Math.ceil((examDate.getTime() - Date.now()) / msPerDay);
  const daysToExam = Number.isFinite(days) ? days : null;
  const crunchMode = daysToExam !== null && daysToExam >= 0 && daysToExam <= 14;
  return { examDate, daysToExam, crunchMode };
}

export default computeCrunchMode;
