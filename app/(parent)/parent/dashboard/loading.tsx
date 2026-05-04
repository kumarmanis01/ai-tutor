/**
 * FILE OBJECTIVE:
 * - Skeleton loading state for the /parent/dashboard page (F-PAR-010 AC-06).
 *   Renders a card-shaped shimmer that matches the populated ParentDashboard layout.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/ParentDashboard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-05-04T00:00:00Z | copilot | created -- F-PAR-010 AC-06 skeleton loading state
 */

export default function ParentDashboardLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 space-y-5" aria-busy="true" aria-label="Loading children">

      {/* Page heading skeleton */}
      <div className="h-7 w-36 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />

      {/* Card skeleton -- matches a single-child card shape */}
      <section className="rounded-xl border border-gray-200 bg-white px-5 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">

        {/* Header row skeleton */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="space-y-2">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="h-8 w-28 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
        </div>

        {/* Stats row skeleton */}
        <div className="mb-4 flex gap-6">
          <div className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-6 w-10 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-6 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>

        {/* Readiness cards skeleton */}
        <div className="space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-12 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      </section>
    </main>
  )
}
