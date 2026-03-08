/**
 * FILE OBJECTIVE:
 * - Placeholder card for the Weekly Study Activity section of the Parent Progress Dashboard.
 * - Will visualise per-day study minutes once API integration is complete.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created placeholder for parent dashboard
 */

export default function ParentWeeklyActivity() {
  return (
    <section
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      aria-label="Weekly Study Activity"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
        <h2 className="text-sm font-semibold text-gray-700">Weekly Study Activity</h2>
      </div>
      <div className="flex h-24 items-center justify-center rounded-xl bg-gray-50">
        <p className="text-sm text-gray-400">Weekly Study Activity (data loading)</p>
      </div>
    </section>
  );
}
