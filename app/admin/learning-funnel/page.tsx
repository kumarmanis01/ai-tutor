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

export default function AdminLearningFunnelPage() {
  const [from, setFrom] = useState(() => toISODate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => toISODate(new Date()));

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set('from', from);
    params.set('to', to);
    return `/api/admin/learning-funnel/summary?${params.toString()}`;
  }, [from, to]);

  const { data, error, isLoading } = useSWR(url, fetcher);
  const s = data?.stages;
  const rates = data?.rates ?? {};
  const dq = data?.dataQuality ?? {};

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Learning Funnel</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Progression through structured tutoring sessions: start → explanation → practice → test → homework → complete.
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
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">Failed to load funnel</div>}

      {data && (
        <>
          {!dq.hasRecommendationComputed && (
            <div className="rounded border border-amber-200 bg-amber-50 text-amber-900 p-3 text-sm">
              Recommendation “shown” is not instrumented. The top stage displayed is session-started; recommendationComputed will appear only when Home Tutor tracing is enabled and decisions are persisted.
            </div>
          )}

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="p-3 text-left font-medium">Stage</th>
                  <th className="p-3 text-right font-medium">Count</th>
                  <th className="p-3 text-right font-medium">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {dq.hasRecommendationComputed && (
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-3 font-medium">Recommendation computed (proxy)</td>
                    <td className="p-3 text-right">{s.recommendationComputed}</td>
                    <td className="p-3 text-right">—</td>
                  </tr>
                )}
                <Row label="Session started" count={s.sessionStarted} conversion={dq.hasRecommendationComputed ? pct(rates.startRateFromRecommendation) : '—'} />
                <Row label="Explanation viewed" count={s.explanationViewed} conversion={pct(rates.explanationViewRate)} />
                <Row label="Practice completed" count={s.practiceCompleted} conversion={pct(rates.practiceCompletionRate)} />
                <Row label="Test completed" count={s.testCompleted} conversion={pct(rates.testCompletionRate)} />
                <Row label="Homework completed" count={s.homeworkCompleted} conversion={pct(rates.homeworkCompletionRate)} />
                <Row label="Session completed" count={s.sessionCompleted} conversion={pct(rates.sessionCompletionRate)} />
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card title="End-to-end completion" value={pct(rates.endToEndFromSessionStart)} />
            <Card title="Explanation view rate" value={pct(rates.explanationViewRate)} />
            <Card title="Homework event coverage" value={pct(dq.homeworkEventCoveragePct)} />
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, count, conversion }: { label: string; count: number; conversion: string }) {
  return (
    <tr className="border-t border-gray-200 dark:border-gray-700">
      <td className="p-3 font-medium">{label}</td>
      <td className="p-3 text-right">{count}</td>
      <td className="p-3 text-right">{conversion}</td>
    </tr>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

