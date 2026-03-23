'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function AdminCurriculumDifficultyPage() {
  const [from, setFrom] = useState(() => toISODate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => toISODate(new Date()));
  const [limit, setLimit] = useState(100);
  const [subjectId, setSubjectId] = useState('');

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set('from', from);
    params.set('to', to);
    params.set('limit', String(limit));
    if (subjectId) params.set('subjectId', subjectId);
    return `/api/admin/curriculum-difficulty/topics?${params.toString()}`;
  }, [from, to, limit, subjectId]);

  const { data, error, isLoading } = useSWR(url, fetcher);
  const items = data?.items ?? [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Curriculum Difficulty</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Topic difficulty index derived from existing learning signals (accuracy, attempts, speed proxy, weak-topic rate).
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
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subject ID (optional)</label>
          <input
            type="text"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            placeholder="cuid..."
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Limit</label>
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading...</div>}
      {error && <div className="text-sm text-red-600">Failed to load difficulty list</div>}

      {!isLoading && items.length === 0 && <div className="text-sm text-gray-500">No topics found.</div>}

      {items.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Topic</th>
                <th className="p-3 text-left font-medium">Subject / Chapter</th>
                <th className="p-3 text-right font-medium">Difficulty</th>
                <th className="p-3 text-right font-medium">Avg accuracy</th>
                <th className="p-3 text-right font-medium">Median attempts</th>
                <th className="p-3 text-right font-medium">Weak rate</th>
                <th className="p-3 text-right font-medium">Speed (median)</th>
                <th className="p-3 text-right font-medium">Sample</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r: any) => (
                <tr key={r.topicId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">
                    {r.topicName}
                    {r.lowData && (
                      <span className="ml-2 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                        LOW_DATA
                      </span>
                    )}
                  </td>
                  <td className="p-3">{r.subjectName} / {r.chapterName}</td>
                  <td className="p-3 text-right font-semibold">{r.difficultyIndex == null ? '--' : r.difficultyIndex.toFixed(1)}</td>
                  <td className="p-3 text-right">{r.avgAccuracy == null ? '--' : `${(r.avgAccuracy * 100).toFixed(1)}%`}</td>
                  <td className="p-3 text-right">{r.medianAttempts == null ? '--' : Math.round(r.medianAttempts)}</td>
                  <td className="p-3 text-right">{r.weakRate == null ? '--' : `${(r.weakRate * 100).toFixed(1)}%`}</td>
                  <td className="p-3 text-right">{r.speedMedian == null ? '--' : r.speedMedian.toFixed(3)}</td>
                  <td className="p-3 text-right">{r.attemptedStudents} students / {r.masteryRows} rows</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

