/**
 * FILE OBJECTIVE:
 * - Live Subject Mastery card for the Parent Progress Dashboard.
 * - Fetches GET /api/parent/subject-mastery and renders one row per subject
 *   with an accuracy bar and topic count.
 * - Handles loading skeleton, empty state, and error state.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created placeholder for parent dashboard
 * - 2026-03-08 | claude | wired to /api/parent/subject-mastery with full states
 */

'use client';

import { useEffect, useState } from 'react';

// TODO: replace with useSession() / auth context once parent session is wired.
const MOCK_STUDENT_ID = 'mock-student';

interface SubjectMastery {
  subject: string;
  avgAccuracy: number; // 0-1
  topicCount: number;
}

/** Converts a 0-1 accuracy float to a rounded percentage string. */
function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Maps a 0-1 accuracy value to a Tailwind bg colour class.
 * Three tiers: strong (≥70%) / developing (40-69%) / needs work (<40%).
 */
function accuracyColour(value: number): string {
  if (value >= 0.7) return 'bg-violet-400';
  if (value >= 0.4) return 'bg-violet-300';
  return 'bg-amber-300';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CardHeader() {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 20h20M6 20V10M12 20V4M18 20v-6" />
        </svg>
      </span>
      <h2 className="text-sm font-semibold text-gray-700">Subject Mastery</h2>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <ul className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading subject mastery">
      {[0, 1, 2].map((i) => (
        <li key={i} className="space-y-1.5">
          <div className="flex justify-between">
            <div className="h-3 w-24 rounded bg-gray-200" />
            <div className="h-3 w-10 rounded bg-gray-200" />
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-gray-50 py-6 px-4 text-center">
      <p className="text-sm font-medium text-gray-500">No subject data yet.</p>
      <p className="text-xs text-gray-400">Mastery data appears after the first study session.</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-red-50 py-6 px-4 text-center">
      <p className="text-sm font-medium text-red-600">Could not load subject data.</p>
      <button
        onClick={onRetry}
        className="text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

function SubjectRow({ item }: { item: SubjectMastery }) {
  const pct = toPercent(item.avgAccuracy);
  const barWidth = `${Math.round(item.avgAccuracy * 100)}%`;

  return (
    <li>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-800 truncate pr-2">{item.subject}</span>
        <span className="text-xs tabular-nums text-violet-600 font-semibold shrink-0">{pct}</span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-gray-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(item.avgAccuracy * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${item.subject} accuracy ${pct}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${accuracyColour(item.avgAccuracy)}`}
          style={{ width: barWidth }}
        />
      </div>
      <p className="mt-0.5 text-[10px] text-gray-400">{item.topicCount} topic{item.topicCount !== 1 ? 's' : ''} studied</p>
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ParentSubjectMastery() {
  const studentId = MOCK_STUDENT_ID;

  const [subjects, setSubjects] = useState<SubjectMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function fetchSubjectMastery() {
    setLoading(true);
    setError(false);

    let cancelled = false;

    fetch(`/api/parent/subject-mastery?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SubjectMastery[]>;
      })
      .then((json) => {
        if (!cancelled) setSubjects(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }

  useEffect(fetchSubjectMastery, [studentId]);

  return (
    <section
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      aria-label="Subject Mastery"
    >
      <CardHeader />

      {loading && <LoadingSkeleton />}

      {!loading && error && <ErrorState onRetry={fetchSubjectMastery} />}

      {!loading && !error && subjects.length === 0 && <EmptyState />}

      {!loading && !error && subjects.length > 0 && (
        <ul className="space-y-4" aria-label="Subject mastery list">
          {subjects.map((s) => (
            <SubjectRow key={s.subject} item={s} />
          ))}
        </ul>
      )}
    </section>
  );
}
