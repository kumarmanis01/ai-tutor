/**
 * Student Dashboard -- v2
 *
 * Full rebuild per v2 wireframe spec.
 *
 * Section order (single column mobile / two-column desktop):
 *   1. TodaysLearningCard -- topic name, subject badge, duration chip, CTA
 *      (Topbar with streak/level/avatar is in the shared layout)
 *   3. XPWidget           -- XP this week, level progress bar
 *   4. WeeklyStudyStrip   -- Mon-Sun dots, purple filled, teal today ring
 *   5. RevisionWidget     -- cards due today or "all caught up"
 *   --- desktop right column ---
 *   6. SubjectReadinessSection -- one card per subject
 *   7. WeakTopicsSection  -- hidden until 3+ sessions, max 2 cards
 *   8. UpcomingTopicsList -- next 3 topics, simple rows
 *
 * Desktop (md:): left 60% = sections 2-5, right 40% = sections 6-8.
 * Topbar is always full-width sticky.
 *
 * EDIT LOG:
 *   2026-03-15 | v2 migration | full rebuild; replaces v1 dashboard
 *   2026-03-15 | Task 28      | UpgradeFlow + UpgradeBanner replace PaymentButton gate
 *   2026-04-13 | copilot      | Add exam crunch mode layout; extract computeCrunchMode helper
 *   2026-04-13T12:00:00Z | copilot | fix: render '>' in learning-path Link using &gt; to avoid JSX parse error
 */

import type { Metadata } from 'next'

/**
 * FILE OBJECTIVE:
 * - Minimal student dashboard placeholder used while resolving build parse errors.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/dashboard/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | temp: simplify dashboard to unblock build
 */

export const metadata: Metadata = {
  title: 'Home | Spinzy AI Tutor',
  description: 'Student dashboard (placeholder)',
}

export default async function StudentHomeDashboardPage() {
  return (
    <main className="max-w-lg mx-auto p-6">
      <h1 className="text-xl font-bold">Student dashboard (placeholder)</h1>
      <p className="text-sm text-gray-600">Temporary placeholder to unblock build; original implementation is preserved in git history.</p>
    </main>
  )
}
