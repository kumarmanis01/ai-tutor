/**
 * FILE OBJECTIVE:
 * - Skeleton placeholder for the LearningPathClient while server data loads.
 * - Matches the page layout: header + countdown banner + 4 week panel shapes.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/learning-path/page.test.tsx
 */

export default function LearningPathSkeleton() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-7 w-48 bg-gray-200 dark:bg-slate-700 rounded mb-1" />
        <div className="h-4 w-64 bg-gray-100 dark:bg-slate-700/60 rounded" />
      </div>

      {/* Countdown banner placeholder */}
      <div className="h-12 rounded-xl bg-gray-100 dark:bg-slate-700/60 mb-6" />

      {/* Week panels */}
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className="rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden mb-4"
        >
          {/* Panel header */}
          <div className="px-4 py-3 bg-white dark:bg-slate-800 flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
            <div className="h-5 w-5 bg-gray-100 dark:bg-slate-700 rounded-full" />
          </div>

          {/* Panel body (shown only for first panel) */}
          {n === 1 && (
            <div className="p-4 space-y-3 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
              {[1, 2].map((m) => (
                <div
                  key={m}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 p-4 space-y-2"
                >
                  <div className="h-4 w-36 bg-gray-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/60 rounded" />
                  <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-700/60 rounded-full" />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Recalculate button placeholder */}
      <div className="h-11 w-48 bg-gray-100 dark:bg-slate-700/60 rounded-xl mt-4" />
    </main>
  );
}
