/**
 * Default loading skeleton for every page inside the (parent) route group.
 *
 * /parent/dashboard supplies its own loading.tsx with a card-shaped
 * shimmer that matches the populated layout; this default handles every
 * other parent page (billing, settings, alerts, ...) so they all stream a
 * consistent skeleton during navigation instead of flashing blank.
 */

export default function ParentDefaultLoading() {
  return (
    <main
      className="mx-auto max-w-2xl px-4 py-6 space-y-5"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-7 w-44 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />

      <section className="rounded-xl border border-gray-200 bg-white px-5 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 space-y-3">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      </section>

      <section className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-12 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
          />
        ))}
      </section>
    </main>
  )
}
