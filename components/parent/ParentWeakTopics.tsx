/**
 * FILE OBJECTIVE:
 * - Placeholder card for the Weak Topics section of the Parent Progress Dashboard.
 * - Will list topics where the student's mastery score is below threshold once API integration is complete.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created placeholder for parent dashboard
 */

export default function ParentWeakTopics() {
  return (
    <section
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      aria-label="Weak Topics"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <h2 className="text-sm font-semibold text-gray-700">Weak Topics</h2>
      </div>
      <div className="flex h-24 items-center justify-center rounded-xl bg-gray-50">
        <p className="text-sm text-gray-400">Weak Topics (data loading)</p>
      </div>
    </section>
  );
}
