'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function pct(x: number | null): string {
  if (x == null) return '--';
  return `${(x * 100).toFixed(0)}%`;
}

export default function AdminStudentRiskPage() {
  const [board, setBoard] = useState('');
  const [grade, setGrade] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(page * limit));
    if (board) params.set('board', board);
    if (grade) params.set('grade', grade);
    if (category) params.set('category', category);
    return `/api/admin/student-risk/students?${params.toString()}`;
  }, [board, grade, category, page]);

  const summaryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (board) params.set('board', board);
    if (grade) params.set('grade', grade);
    return `/api/admin/student-risk/summary?${params.toString()}`;
  }, [board, grade]);

  const { data: summary } = useSWR(summaryUrl, fetcher);
  const { data, isLoading } = useSWR(listUrl, fetcher);

  const students = data?.students ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Risk Detection</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Risk is computed from inactivity, weak-topic breadth, accuracy trend proxy, and session completion rate.
      </p>

      <div className="grid grid-cols-3 gap-4">
        <Card title="High" value={summary?.high ?? '--'} />
        <Card title="Medium" value={summary?.medium ?? '--'} />
        <Card title="Low" value={summary?.low ?? '--'} />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
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
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(0); }}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
        >
          <option value="">All categories</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading...</div>}

      {!isLoading && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Student</th>
                <th className="p-3 text-left font-medium">Board / Grade</th>
                <th className="p-3 text-right font-medium">Risk</th>
                <th className="p-3 text-right font-medium">Inactive days</th>
                <th className="p-3 text-right font-medium">Weak topics</th>
                <th className="p-3 text-right font-medium">Completion</th>
                <th className="p-3 text-right font-medium">Acc Δ</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-gray-500">No students match filters.</td></tr>
              )}
              {students.map((s: any) => (
                <tr key={s.studentId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">{s.name || s.email || s.studentId}</td>
                  <td className="p-3">{s.board ?? '--'} / {s.grade ?? '--'}</td>
                  <td className="p-3 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs ${s.category === 'high' ? 'bg-red-100 text-red-800' : s.category === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                      {s.riskScore} ({s.category})
                    </span>
                  </td>
                  <td className="p-3 text-right">{s.inactiveDays ?? '--'}</td>
                  <td className="p-3 text-right">{s.weakTopicCount}</td>
                  <td className="p-3 text-right">{pct(s.completionRate)}</td>
                  <td className="p-3 text-right">{s.accDelta == null ? '--' : `${(s.accDelta * 100).toFixed(1)} pts`}</td>
                </tr>
              ))}
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

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

