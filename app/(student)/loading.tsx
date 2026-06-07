/**
 * Default loading skeleton for every page inside the (student) route group.
 *
 * Without this file Next.js falls back to an instant unstyled flash on
 * navigation; with it, the framework streams this skeleton during the
 * server-component fetch so the student always sees a smooth shimmer.
 * Pages that need a tighter shape can colocate their own loading.tsx -- it
 * takes precedence over this default.
 */

export default function StudentDefaultLoading() {
  return (
    <main
      className="mx-auto max-w-3xl px-4 py-6 space-y-5 sm:py-8"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-7 w-40 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />

      <section className="rounded-2xl border border-gray-200 bg-white px-5 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="space-y-3">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-14 w-full animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
          />
        ))}
      </section>
    </main>
  )
}
