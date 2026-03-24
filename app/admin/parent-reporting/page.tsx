'use client';

import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminParentReportingPage() {
  const [board, setBoard] = useState('');
  const [grade, setGrade] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;
  const [_paused, setPaused] = useState<boolean | null>(null);
  const [savingPause, setSavingPause] = useState(false);

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(page * limit));
  if (board) params.set('board', board);
  if (grade) params.set('grade', grade);
  const q = params.toString();

  const { data: scope, mutate: mutateScope } = useSWR('/api/admin/parent-reporting/scope', fetcher);
  const { data: settings, mutate: mutateSettings } = useSWR('/api/admin/parent-reporting/settings', fetcher);
  const { data: listData, isLoading } = useSWR(`/api/admin/parent-reporting/students?${q}`, fetcher);

  const students = listData?.students ?? [];
  const total = listData?.total ?? 0;
  const reportsPaused = settings?.reportsPaused ?? false;

  const handleTogglePause = async () => {
    setSavingPause(true);
    try {
      const res = await fetch('/api/admin/parent-reporting/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportsPaused: !reportsPaused }),
      });
      if (res.ok) {
        setPaused(!reportsPaused);
        await mutateSettings();
        await mutateScope();
      }
    } finally {
      setSavingPause(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parent Report Monitoring</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Students with linked parents, weekly report scope, and global pause for weekly parent reports.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Students with linked parents</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{scope?.studentsWithLinkedParents ?? '--'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Reports this week</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{scope?.reportsGeneratedThisWeek ?? '--'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col justify-center">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Weekly parent reports</div>
          <button
            type="button"
            onClick={handleTogglePause}
            disabled={savingPause}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${reportsPaused ? 'bg-amber-600 text-white' : 'bg-green-600 text-white'} disabled:opacity-50`}
          >
            {reportsPaused ? 'Paused -- Click to resume' : 'Active -- Click to pause'}
          </button>
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
        <button type="button" onClick={() => setPage(0)} className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm font-medium">
          Apply
        </button>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading...</div>}
      {!isLoading && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Student</th>
                <th className="p-3 text-left font-medium">Board / Grade</th>
                <th className="p-3 text-left font-medium">Last report week</th>
                <th className="p-3 text-left font-medium">Report this week</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">No students match filters.</td>
                </tr>
              )}
              {students.map((s: { studentId: string; studentName: string | null; studentEmail: string | null; board: string | null; grade: string | null; lastReportWeekStart: string | null; hasReport: boolean }) => (
                <tr key={s.studentId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">{s.studentName || s.studentEmail || s.studentId}</td>
                  <td className="p-3">{s.board ?? '--'} / {s.grade ?? '--'}</td>
                  <td className="p-3">{s.lastReportWeekStart ? new Date(s.lastReportWeekStart).toLocaleDateString() : '--'}</td>
                  <td className="p-3">{s.hasReport ? 'Yes' : 'No'}</td>
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
