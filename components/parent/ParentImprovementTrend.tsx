/**
 * FILE OBJECTIVE:
 * - Live Improvement Trend card for the Parent Progress Dashboard.
 * - Fetches GET /api/parent/improvement-trend and renders a week-by-week
 *   accuracy line chart using recharts (already a project dependency).
 * - Handles loading skeleton, sparse-data fallback, and error state.
 *
 * CHART CHOICE: recharts LineChart + ResponsiveContainer.
 * - recharts is already used across this codebase (ParentDashboardClient).
 * - ResponsiveContainer makes the chart fill its grid cell on any viewport.
 * - A monotone curve smooths noise in the data without misrepresenting it.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created placeholder for parent dashboard
 * - 2026-03-08 | claude | wired to /api/parent/improvement-trend with recharts line chart
 */

'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

// TODO: replace with useSession() / auth context once parent session is wired.
const MOCK_STUDENT_ID = 'mock-student';

interface TrendPoint {
  week: string;     // e.g. "2026-W10"
  accuracy: number; // 0–1 float
}

/** Converts "2026-W10" → "W10" for a compact X-axis label. */
function shortWeek(isoWeek: string): string {
  const parts = isoWeek.split('-');
  return parts[1] ?? isoWeek;
}

/** Formats a 0–1 accuracy value as "58%" for tooltip / Y-axis. */
function fmtPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CardHeader() {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      </span>
      <h2 className="text-sm font-semibold text-gray-700">Improvement Trend</h2>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-2" aria-busy="true" aria-label="Loading trend chart">
      {/* Simulated chart bars */}
      <div className="flex items-end gap-1 h-28 px-1">
        {[55, 40, 65, 50, 75, 60, 80, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gray-200"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      {/* Simulated X-axis labels */}
      <div className="flex gap-1 px-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-1 h-2 rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-gray-50 py-8 px-4 text-center h-36">
      <p className="text-sm font-medium text-gray-500">No trend data yet.</p>
      <p className="text-xs text-gray-400">Data will appear after a few weeks of activity.</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-red-50 py-6 px-4 text-center h-36">
      <p className="text-sm font-medium text-red-600">Could not load trend data.</p>
      <button
        onClick={onRetry}
        className="text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

// Custom tooltip shown on hover — cleaner than recharts default for parents.
function TrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-gray-600 mb-0.5">{label}</p>
      <p className="text-emerald-600 font-bold">{fmtPct(payload[0].value)}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ParentImprovementTrend() {
  const studentId = MOCK_STUDENT_ID;

  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function fetchTrend() {
    setLoading(true);
    setError(false);

    let cancelled = false;

    fetch(`/api/parent/improvement-trend?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TrendPoint[]>;
      })
      .then((json) => {
        if (!cancelled) setPoints(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }

  useEffect(fetchTrend, [studentId]);

  // Recharts needs the data in a flat object shape.
  // We keep accuracy as 0–1 and format it at render time to avoid
  // a second mapping pass.
  const chartData = points.map((p) => ({
    week: shortWeek(p.week),      // "W10"
    accuracy: p.accuracy,          // 0–1 (formatted by tickFormatter / tooltip)
  }));

  return (
    <section
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      aria-label="Improvement Trend"
    >
      <CardHeader />

      {loading && <LoadingSkeleton />}

      {!loading && error && <ErrorState onRetry={fetchTrend} />}

      {!loading && !error && points.length === 0 && <EmptyState />}

      {!loading && !error && points.length > 0 && (
        <>
          {/* Summary: latest accuracy at a glance */}
          <p className="mb-3 text-xs text-gray-400">
            Latest accuracy:{' '}
            <span className="font-semibold text-emerald-600">
              {fmtPct(points[points.length - 1].accuracy)}
            </span>
            {points.length > 1 && (() => {
              const delta = points[points.length - 1].accuracy - points[0].accuracy;
              const sign = delta >= 0 ? '+' : '';
              return (
                <span className={delta >= 0 ? 'text-emerald-500' : 'text-red-400'}>
                  {' '}({sign}{fmtPct(Math.abs(delta))} over {points.length} weeks)
                </span>
              );
            })()}
          </p>

          {/* Line chart */}
          <div className="h-36" aria-label="Accuracy trend line chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={fmtPct}
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1]}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip content={<TrendTooltip />} />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#059669', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
