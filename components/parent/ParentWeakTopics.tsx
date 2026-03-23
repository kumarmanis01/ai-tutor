/**
 * FILE OBJECTIVE:
 * - Live Weak Topics card for the Parent Progress Dashboard.
 * - Fetches GET /api/parent/weak-topics and renders up to 5 topics that need
 *   the student's attention, each with a mastery percentage bar.
 * - Falls back to displaying topicId when a human-readable name is unavailable.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created placeholder for parent dashboard
 * - 2026-03-08 | claude | wired to /api/parent/weak-topics with full states
 */

'use client';

import { useEffect, useState } from 'react';

// TODO: replace with useSession() / auth context once parent session is wired.
const MOCK_STUDENT_ID = 'mock-student';

interface WeakTopic {
  topicId: string;
  mastery: number;      // 0-1 float from the API
  practiceCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts a 0-1 mastery float to a rounded percentage string, e.g. "32%". */
function toPercent(mastery: number): string {
  return `${Math.round(mastery * 100)}%`;
}

/**
 * Returns a Tailwind width class for the mastery progress bar.
 * Snaps to the nearest 5% step that Tailwind includes by default.
 */
function masteryBarWidth(mastery: number): string {
  const pct = Math.round(mastery * 100);
  // Tailwind purges arbitrary values, so we map to known fraction classes.
  if (pct <= 10) return 'w-[10%]';
  if (pct <= 20) return 'w-1/5';
  if (pct <= 25) return 'w-1/4';
  if (pct <= 30) return 'w-[30%]';
  if (pct <= 33) return 'w-1/3';
  if (pct <= 40) return 'w-[40%]'; // ceiling is < 40% per API contract
  return 'w-2/5';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CardHeader() {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
      <h2 className="text-sm font-semibold text-gray-700">Needs Attention</h2>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <ul className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading weak topics">
      {[0, 1, 2].map((i) => (
        <li key={i} className="space-y-1.5">
          <div className="h-3 w-32 rounded bg-gray-200" />
          <div className="h-1.5 w-full rounded-full bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-emerald-50 py-6 px-4 text-center">
      <p className="text-sm font-medium text-emerald-700">All topics looking good!</p>
      <p className="text-xs text-emerald-600">No weak areas detected this week.</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-red-50 py-6 px-4 text-center">
      <p className="text-sm font-medium text-red-600">Could not load topic data.</p>
      <button
        onClick={onRetry}
        className="text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

function TopicRow({ topic }: { topic: WeakTopic }) {
  // topicId is a cuid like "clxyz123..."; show it as a readable fallback.
  // When a name mapping is available it will replace topicId via props.
  const displayName = topic.topicId;
  const pct = toPercent(topic.mastery);

  return (
    <li>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-800 truncate pr-2">{displayName}</span>
        <span className="text-xs tabular-nums text-amber-600 font-semibold shrink-0">{pct}</span>
      </div>
      {/* Mastery bar */}
      <div
        className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(topic.mastery * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${displayName} mastery ${pct}`}
      >
        <div
          className={`h-full rounded-full bg-amber-400 transition-all duration-500 ${masteryBarWidth(topic.mastery)}`}
        />
      </div>
      <p className="mt-0.5 text-[10px] text-gray-400">
        Mastery: {pct} · {topic.practiceCount} practices
      </p>
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ParentWeakTopics() {
  const studentId = MOCK_STUDENT_ID;

  const [topics, setTopics] = useState<WeakTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function fetchWeakTopics() {
    setLoading(true);
    setError(false);

    let cancelled = false;

    fetch(`/api/parent/weak-topics?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<WeakTopic[]>;
      })
      .then((json) => {
        if (!cancelled) setTopics(json.slice(0, 5)); // guard: never render > 5
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }

  useEffect(fetchWeakTopics, [studentId]);

  return (
    <section
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      aria-label="Needs Attention"
    >
      <CardHeader />

      {loading && <LoadingSkeleton />}

      {!loading && error && <ErrorState onRetry={fetchWeakTopics} />}

      {!loading && !error && topics.length === 0 && <EmptyState />}

      {!loading && !error && topics.length > 0 && (
        <ul className="space-y-4" aria-label="Topics needing attention">
          {topics.map((t) => (
            <TopicRow key={t.topicId} topic={t} />
          ))}
        </ul>
      )}
    </section>
  );
}
