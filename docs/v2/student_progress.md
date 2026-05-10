<!--
FILE OBJECTIVE:
- Analysis note for the student progress page audit, including the observed
  8%/0% chapter-mastery pattern, root causes, and the implemented fixes.

LINKED UNIT TEST:
- tests/unit/app/student/progress/subjectFilter.spec.ts
- tests/unit/lib/student/examReadiness.test.ts
- tests/unit/components/student/progress/ChapterMasteryBars.spec.tsx

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/COPILOT_GUARDRAILS.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-05-10T00:00:00Z | copilot | documented progress-page audit findings and fixes
-->

# Student Progress Audit

The `/student/progress` page was showing a repeating pattern of `0%` mastery and
roughly `8%` board-weight chips across a long chapter list. The data was not
entirely wrong, but the UI made two separate fallback states look like normal
curriculum data:

1. `0%` mastery was the honest result of chapters with no mastered concepts.
2. `8%` was the equal-weight fallback used when board chapter weights were not
   seeded yet.

## Gaps Found

- Subject matching used the display name only on the read path, even though the
  enrolled subject list can contain either names or slugs.
- The chapter mastery card rendered estimated board weights the same way as real
  weights, so fallback data looked authoritative.
- The mastery list is rendered eagerly for every subject, which is acceptable for
  small accounts but becomes a long, dense scroll surface as chapter counts grow.
- The progress page had no explicit marker showing that a subject row was based on
  the equal-weight fallback rather than seeded board weights.

## Fixes Applied

- Normalized subject matching with a shared helper that accepts both subject
  names and slugs.
- Added `weightSource` metadata from readiness calculation so the UI can label
  estimated weights explicitly.
- Reworked chapter mastery rows to remove inline styles, use reusable width
  utility classes, and keep the progress bars accessible without invalid ARIA
  attributes.
- Added unit coverage for subject normalization, equal-weight fallback metadata,
  and the chapter mastery UI state.

## Remaining Scalability Notes

The page still computes readiness per subject and renders the full chapter list in
one pass. That is fine for current data volumes, but it will eventually benefit
from one of these patterns if subject or chapter counts increase significantly:

- subject-level lazy expansion,
- server-side pagination or chunking,
- or a compact summary card that opens the detailed chapter list on demand.

For now, the page is correct, but the fallback state is now labeled clearly so the
8% values are understood as estimates rather than seeded curriculum weights.
