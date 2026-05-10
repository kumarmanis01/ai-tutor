/**
 * FILE OBJECTIVE:
 * - Shared helpers for the student progress page, including subject matching
 *   and subject-name normalization for filter and lookup logic.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/progress/subjectFilter.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-10T00:00:00Z | copilot | extracted subject normalization helpers for /student/progress
 */

export interface SubjectDefLike {
  name: string
  slug: string
}

export function normalizeSubjectKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, ' ')
}

export function subjectDefMatchesActiveSubject(
  subjectDef: SubjectDefLike,
  activeSubject: string,
): boolean {
  const activeKey = normalizeSubjectKey(activeSubject)
  return [subjectDef.name, subjectDef.slug].some(
    (value) => normalizeSubjectKey(value) === activeKey,
  )
}
