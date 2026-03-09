'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export default function AdminRecommendationPerformancePage() {
  const [from, setFrom] = useState(() => toISODate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => toISODate(new Date()));
  const [windowMin, setWindowMin] = useState(30);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set('from', from);
    params.set('to', to);
    params.set('attributionWindowMinutes', String(windowMin));
    return `/api/admin/recommendation-performance/summary?${params.toString()}`;
  }, [from, to, windowMin]);

  const { data, error, isLoading } = useSWR(url, fetcher);

  const rows = data?.rows ?? [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recommendation Performance</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Aggregated performance for Home Tutor Engine rules (P0–P6). Attribution is based on sessionId when present,
        otherwise by studentId+topicId with a time window.
      </p>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Attribution window (min)</label>
          <select
            value={windowMin}
            onChange={(e) => setWindowMin(parseInt(e.target.value, 10))}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={120}>120</option>
          </select>
        </div>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">Failed to load summary</div>}

      {!isLoading && rows.length === 0 && (
        <div className="text-sm text-gray-500">
          No aggregated decisions found. Ensure `ENABLE_REC_TRACE=1` is enabled so the Home Tutor Engine persists decision facts.
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Rule</th>
                <th className="p-3 text-right font-medium">Decisions</th>
                <th className="p-3 text-right font-medium">Attribution</th>
                <th className="p-3 text-right font-medium">Session start rate</th>
                <th className="p-3 text-right font-medium">Completion rate</th>
                <th className="p-3 text-right font-medium">Avg accuracy improvement</th>
                <th className="p-3 text-right font-medium">Improvement coverage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.ruleId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">{r.ruleId}</td>
                  <td className="p-3 text-right">{r.decisions}</td>
                  <td className="p-3 text-right" title={`${r.attributedDecisions}/${r.decisions}`}>
                    {pct(r.attributionPct)}
                  </td>
                  <td className="p-3 text-right">{pct(r.sessionStartRate)}</td>
                  <td className="p-3 text-right">{pct(r.sessionCompletionRate)}</td>
                  <td className="p-3 text-right">
                    {r.avgAccuracyImprovement == null ? '—' : `${(r.avgAccuracyImprovement * 100).toFixed(1)} pts`}
                  </td>
                  <td className="p-3 text-right">{pct(r.improvementCoverage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

