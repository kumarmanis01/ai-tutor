'use client';

import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminContentReadinessPage() {
  const [board, setBoard] = useState('');
  const [grade, setGrade] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(page * limit));
  if (board) params.set('board', board);
  if (grade) params.set('grade', grade);
  if (status) params.set('status', status);
  const q = params.toString();

  const { data: summary } = useSWR('/api/admin/content-readiness/summary', fetcher);
  const { data: listData, isLoading } = useSWR(`/api/admin/content-readiness?${q}`, fetcher);

  const items = listData?.items ?? [];
  const total = listData?.total ?? 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Readiness</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        HydrationJob status by topic. Summary counts and list with filters.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.pending ?? '--'}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Running</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.running ?? '--'}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Failed</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {summary?.failed ?? '--'}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {summary?.completed ?? '--'}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Generation paused
          </div>
          <div className="text-sm font-bold">{summary?.generationPaused ? 'Yes' : 'No'}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Board"
          value={board}
          onChange={(e) => setBoard(e.target.value)}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
        />
        <input
          type="text"
          placeholder="Grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <button
          type="button"
          onClick={() => setPage(0)}
          className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm font-medium"
        >
          Apply
        </button>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading...</div>}
      {!isLoading && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Topic</th>
                <th className="p-3 text-left font-medium">Subject / Chapter</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Content ready</th>
                <th className="p-3 text-left font-medium">Last error</th>
                <th className="p-3 text-left font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No jobs match filters.
                  </td>
                </tr>
              )}
              {items.map(
                (j: {
                  jobId: string;
                  topicName: string;
                  subjectName: string;
                  chapterName: string;
                  status: string;
                  contentReady: boolean;
                  lastError: string | null;
                  updatedAt: string;
                }) => (
                  <tr key={j.jobId} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-3 font-medium">{j.topicName}</td>
                    <td className="p-3">
                      {j.subjectName} / {j.chapterName}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${j.status === 'failed' ? 'bg-red-100 text-red-800' : j.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="p-3">{j.contentReady ? 'Yes' : 'No'}</td>
                    <td className="p-3 max-w-xs truncate" title={j.lastError ?? ''}>
                      {j.lastError ?? '--'}
                    </td>
                    <td className="p-3">{new Date(j.updatedAt).toLocaleString()}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={(page + 1) * limit >= total}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
