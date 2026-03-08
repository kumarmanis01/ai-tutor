/**
 * FILE OBJECTIVE:
 * - Placeholder card for the Subject Mastery section of the Parent Progress Dashboard.
 * - Will render per-subject coverage and average mastery scores once API integration is complete.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created placeholder for parent dashboard
 */

export default function ParentSubjectMastery() {
  return (
    <section
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      aria-label="Subject Mastery"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 20h20M6 20V10M12 20V4M18 20v-6" />
          </svg>
        </span>
        <h2 className="text-sm font-semibold text-gray-700">Subject Mastery</h2>
      </div>
      <div className="flex h-24 items-center justify-center rounded-xl bg-gray-50">
        <p className="text-sm text-gray-400">Subject Mastery (data loading)</p>
      </div>
    </section>
  );
}
