'use client';

import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type View = 'by-topic' | 'by-student';

export default function AdminWeakTopicsPage() {
  const [view, setView] = useState<View>('by-topic');
  const [board, setBoard] = useState('');
  const [grade, setGrade] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const params = new URLSearchParams();
  if (board) params.set('board', board);
  if (grade) params.set('grade', grade);
  if (subjectId) params.set('subjectId', subjectId);
  params.set('limit', '100');
  const q = params.toString();

  const { data: summary } = useSWR('/api/admin/weak-topics/summary', fetcher);
  const { data: byTopicData, isLoading: loadingTopic } = useSWR(
    view === 'by-topic' ? `/api/admin/weak-topics/by-topic?${q}` : null,
    fetcher
  );
  const { data: byStudentData, isLoading: loadingStudent } = useSWR(
    view === 'by-student' ? `/api/admin/weak-topics/by-student?${q}` : null,
    fetcher
  );

  const topics = byTopicData?.topics ?? [];
  const students = byStudentData?.students ?? [];
  const isLoading = view === 'by-topic' ? loadingTopic : loadingStudent;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Weak Topic Monitoring</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Topics where students have practiced (5+ attempts) but mastery remains below 40%. Same definition as product weak-topic logic.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Students with weak topics</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.totalStudentsWithWeakTopics ?? '--'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total weak-topic instances</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.totalWeakTopicInstances ?? '--'}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
        <input
          type="text"
          placeholder="Board (e.g. cbse)"
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
        <input
          type="text"
          placeholder="Subject ID"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
        />
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setView('by-topic')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'by-topic' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          By topic
        </button>
        <button
          type="button"
          onClick={() => setView('by-student')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'by-student' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          By student
        </button>
      </div>

      {/* Table */}
      {isLoading && <div className="text-sm text-gray-500">Loading...</div>}
      {!isLoading && view === 'by-topic' && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Topic</th>
                <th className="p-3 text-left font-medium">Subject / Chapter</th>
                <th className="p-3 text-left font-medium">Students weak</th>
                <th className="p-3 text-left font-medium">Severity</th>
              </tr>
            </thead>
            <tbody>
              {topics.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">No weak topics match filters.</td>
                </tr>
              )}
              {topics.map((t: { topicId: string; topicName: string; subjectName: string; chapterName: string; studentCount: number; severity: string }) => (
                <tr key={t.topicId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">{t.topicName}</td>
                  <td className="p-3">{t.subjectName} / {t.chapterName}</td>
                  <td className="p-3">{t.studentCount}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.severity === 'high' ? 'bg-red-100 text-red-800' : t.severity === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                      {t.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!isLoading && view === 'by-student' && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Student</th>
                <th className="p-3 text-left font-medium">Board / Grade</th>
                <th className="p-3 text-left font-medium">Weak topics</th>
                <th className="p-3 text-left font-medium">Severity</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">No students with weak topics match filters.</td>
                </tr>
              )}
              {students.map((s: { studentId: string; studentEmail: string | null; studentName: string | null; board: string | null; grade: string | null; weakTopicCount: number; topicNames: string[]; severity: string }) => (
                <tr key={s.studentId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">{s.studentName || s.studentEmail || s.studentId}</td>
                  <td className="p-3">{s.board ?? '--'} / {s.grade ?? '--'}</td>
                  <td className="p-3" title={s.topicNames?.join(', ')}>{s.weakTopicCount} ({s.topicNames?.slice(0, 2).join(', ')}{s.topicNames?.length > 2 ? '...' : ''})</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${s.severity === 'high' ? 'bg-red-100 text-red-800' : s.severity === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}`}>
                      {s.severity}
                    </span>
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
