/**
 * FILE OBJECTIVE:
 * - Live Weekly Study Activity card for the Parent Progress Dashboard.
 * - Self-fetching client component: calls GET /api/parent/weekly-activity
 *   and renders three metrics -- Study Time, Sessions Completed, Topics Studied.
 * - Handles loading skeleton and error states inline; no global state needed.
 *
 * DATA FETCHING STRATEGY:
 * - "use client" + useEffect + useState (cancel-safe via cleanup flag).
 *   The component owns its own fetch lifecycle: it mounts, fires one GET,
 *   and reconciles the result into local state. No SWR / React Query / context
 *   is introduced; the data is local to this card and never shared upward.
 *
 * CLIENT vs SERVER CHOICE:
 * - Must be a Client Component because it reads auth state at runtime and
 *   uses browser APIs (fetch, useState, useEffect). A Server Component would
 *   need the studentId at request time (passed as a prop or from cookies),
 *   which is valid but would require refactoring the parent page into a
 *   suspense boundary. The self-fetching client pattern matches how the rest
 *   of the dashboard components in this codebase work (see WeeklyProgress.tsx).
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created placeholder for parent dashboard
 * - 2026-03-08 | claude | wired to /api/parent/weekly-activity with full states
 */

'use client';

import { useEffect, useState } from 'react';

// TODO: replace with useSession() / auth context once parent session is wired.
const MOCK_STUDENT_ID = 'mock-student';

interface WeeklyActivityData {
  studyMinutes: number;
  sessionsCompleted: number;
  topicsStudied: number;
}

/** Converts a raw minute count to "Xh Ym" or "Ym" display string. */
function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CardHeader() {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </span>
      <h2 className="text-sm font-semibold text-gray-700">Weekly Study Activity</h2>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse grid grid-cols-3 gap-3" aria-busy="true" aria-label="Loading weekly activity">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col items-center gap-2 rounded-xl bg-gray-50 py-4 px-2">
          <div className="h-3 w-16 rounded bg-gray-200" />
          <div className="h-7 w-10 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-red-50 py-6 px-4 text-center">
      <p className="text-sm text-red-600 font-medium">Could not load activity data.</p>
      <button
        onClick={onRetry}
        className="text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

interface MetricChipProps {
  label: string;
  value: string;
  subLabel?: string;
}

function MetricChip({ label, value, subLabel }: MetricChipProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-gray-50 py-4 px-2 text-center">
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-2xl font-bold text-gray-800 tabular-nums leading-tight">{value}</span>
      {subLabel && (
        <span className="text-[10px] text-gray-400">{subLabel}</span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ParentWeeklyActivity() {
  const studentId = MOCK_STUDENT_ID;

  const [data, setData] = useState<WeeklyActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function fetchActivity() {
    setLoading(true);
    setError(false);

    let cancelled = false;

    fetch(`/api/parent/weekly-activity?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<WeeklyActivityData>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }

  useEffect(fetchActivity, [studentId]);

  const metrics = data
    ? [
        { label: 'Study Time',  value: formatMinutes(data.studyMinutes) },
        { label: 'Sessions',    value: String(data.sessionsCompleted) },
        { label: 'Topics',      value: String(data.topicsStudied) },
      ]
    : [];

  return (
    <section
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      aria-label="Weekly Study Activity"
    >
      <CardHeader />

      {loading && <LoadingSkeleton />}

      {!loading && error && <ErrorState onRetry={fetchActivity} />}

      {!loading && !error && data && (
        <div className="grid grid-cols-3 gap-3">
          {metrics.map((m) => (
            <MetricChip key={m.label} label={m.label} value={m.value} />
          ))}
        </div>
      )}
    </section>
  );
}
