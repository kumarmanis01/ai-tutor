'use client';

import useSWR from 'swr';
import { useState } from 'react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminStudentLearningPage() {
  const [board, setBoard] = useState('');
  const [grade, setGrade] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(page * limit));
  if (board) params.set('board', board);
  if (grade) params.set('grade', grade);
  const q = params.toString();

  const { data: summary } = useSWR('/api/admin/student-learning/summary', fetcher);
  const { data: listData, isLoading } = useSWR(`/api/admin/student-learning/students?${q}`, fetcher);

  const students = listData?.students ?? [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Learning Analytics</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Overview of students (role=user), activity in last 7 days, and homework/weak topics.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total students</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.totalStudents ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Active (7d)</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.activeStudentsLast7Days ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Sessions (7d)</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.sessionsCompletedLast7Days ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Homework pending</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.homeworkPendingCount ?? '—'}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
        <button
          type="button"
          onClick={() => setPage(0)}
          className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm font-medium"
        >
          Apply
        </button>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      {!isLoading && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Student</th>
                <th className="p-3 text-left font-medium">Board / Grade</th>
                <th className="p-3 text-left font-medium">Sessions (7d)</th>
                <th className="p-3 text-left font-medium">Last active</th>
                <th className="p-3 text-left font-medium">HW pending</th>
                <th className="p-3 text-left font-medium">Weak topics</th>
                <th className="p-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">No students match filters.</td>
                </tr>
              )}
              {students.map((s: { studentId: string; name: string | null; email: string | null; board: string | null; grade: string | null; sessionsCompleted7d: number; lastActiveAt: string | null; homeworkPending: number; weakTopicCount: number }) => (
                <tr key={s.studentId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">{s.name || s.email || s.studentId}</td>
                  <td className="p-3">{s.board ?? '—'} / {s.grade ?? '—'}</td>
                  <td className="p-3">{s.sessionsCompleted7d}</td>
                  <td className="p-3">{s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleDateString() : '—'}</td>
                  <td className="p-3">{s.homeworkPending}</td>
                  <td className="p-3">{s.weakTopicCount}</td>
                  <td className="p-3">
                    <Link href={`/admin/student-learning/${s.studentId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      View
                    </Link>
                  </td>
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
          disabled={students.length < limit}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
