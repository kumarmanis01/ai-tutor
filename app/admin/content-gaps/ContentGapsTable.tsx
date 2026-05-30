'use client';

import { useState } from 'react';

export interface ContentGapRow {
  id: string;
  subjectName: string;
  boardSlug: string;
  grade: number;
  topicName: string;
  difficulty: string;
  currentCount: number;
  targetCount: number;
  status: string;
  detectedAt: string;
  hydrationJobId: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  detected: 'bg-[#FCEBEB] text-[#791F1F]',
  hydration_pending: 'bg-[#FAEEDA] text-[#633806]',
  resolved: 'bg-[#EAF3DE] text-[#27500A]',
  ignored: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'text-[#1D9E75]',
  medium: 'text-[#BA7517]',
  hard: 'text-[#E24B4A]',
};

export function ContentGapsTable({ rows }: { rows: ContentGapRow[] }) {
  const [filter, setFilter] = useState<string>('all');
  const [triggering, setTriggering] = useState<Record<string, boolean>>({});

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  async function triggerHydration(id: string) {
    setTriggering((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/content-gaps/${id}/hydrate`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(`Failed: ${body.error ?? res.statusText}`);
      } else {
        window.location.reload();
      }
    } catch {
      alert('Network error -- check the console');
    } finally {
      setTriggering((prev) => ({ ...prev, [id]: false }));
    }
  }

  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 text-sm">
        {(['all', 'detected', 'hydration_pending', 'resolved', 'ignored'] as const).map((s) => {
          const count = s === 'all' ? rows.length : (statusCounts[s] ?? 0);
          const active = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full font-medium min-h-[36px] border transition-colors ${
                active
                  ? 'bg-[#534AB7] text-white border-[#534AB7]'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#534AB7]'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          No gaps match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Count</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Detected</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    {row.subjectName}
                    <span className="ml-1.5 text-[11px] text-gray-400 font-normal">
                      {row.boardSlug.toUpperCase()} G{row.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[200px] truncate">
                    {row.topicName}
                  </td>
                  <td className={`px-4 py-3 font-semibold capitalize ${DIFFICULTY_STYLES[row.difficulty] ?? ''}`}>
                    {row.difficulty}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {row.currentCount}
                    <span className="text-gray-400">/{row.targetCount}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                        STATUS_STYLES[row.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(row.detectedAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {row.status !== 'resolved' && row.status !== 'ignored' && (
                      <button
                        onClick={() => triggerHydration(row.id)}
                        disabled={triggering[row.id] || row.status === 'hydration_pending'}
                        className="px-3 py-1.5 min-h-[36px] min-w-[44px] text-xs font-medium rounded-lg bg-[#534AB7] text-white hover:bg-[#4239a0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {triggering[row.id] ? 'Queuing...' : 'Trigger hydration'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
