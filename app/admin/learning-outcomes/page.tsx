'use client';

import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminLearningOutcomesPage() {
  const [board, setBoard] = useState('');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');

  const params = new URLSearchParams();
  if (board) params.set('board', board);
  if (grade) params.set('grade', grade);
  if (subject) params.set('subject', subject);
  const q = params.toString();

  const { data: summary } = useSWR(`/api/admin/learning-outcomes/summary?${q}`, fetcher);
  const { data: bySubjectData } = useSWR(`/api/admin/learning-outcomes/by-subject?${q}`, fetcher);
  const { data: topData } = useSWR(`/api/admin/learning-outcomes/top-improving?${q}&limit=20`, fetcher);

  const subjects = bySubjectData?.subjects ?? [];
  const topTopics = topData?.topics ?? [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Learning Outcome Analytics</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Aggregates from StudentTopicMastery: accuracy and mastery distribution by subject; top topics by average accuracy.
      </p>

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
        <input
          type="text"
          placeholder="Subject filter"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total mastery records</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.totalRecords ?? '--'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Overall avg accuracy</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.overallAvgAccuracy != null ? `${(summary.overallAvgAccuracy * 100).toFixed(1)}%` : '--'}
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">By subject</h2>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Subject</th>
                <th className="p-3 text-left font-medium">Students</th>
                <th className="p-3 text-left font-medium">Topic records</th>
                <th className="p-3 text-left font-medium">Avg accuracy</th>
                <th className="p-3 text-left font-medium">Mastery distribution</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gray-500">No data</td></tr>
              )}
              {subjects.map((row: { subject: string; studentCount: number; topicCount: number; avgAccuracy: number; beginnerCount: number; intermediateCount: number; advancedCount: number; expertCount: number }) => (
                <tr key={row.subject} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">{row.subject}</td>
                  <td className="p-3">{row.studentCount}</td>
                  <td className="p-3">{row.topicCount}</td>
                  <td className="p-3">{(row.avgAccuracy * 100).toFixed(1)}%</td>
                  <td className="p-3 text-xs">
                    B:{row.beginnerCount} I:{row.intermediateCount} A:{row.advancedCount} E:{row.expertCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Top topics by accuracy</h2>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Topic</th>
                <th className="p-3 text-left font-medium">Subject / Chapter</th>
                <th className="p-3 text-left font-medium">Avg accuracy</th>
                <th className="p-3 text-left font-medium">Students</th>
                <th className="p-3 text-left font-medium">Level</th>
              </tr>
            </thead>
            <tbody>
              {topTopics.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gray-500">No data</td></tr>
              )}
              {topTopics.map((t: { topicId: string; topicName: string; subject: string; chapter: string; avgAccuracy: number; studentCount: number; masteryLevel: string }) => (
                <tr key={t.topicId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3 font-medium">{t.topicName}</td>
                  <td className="p-3">{t.subject} / {t.chapter}</td>
                  <td className="p-3">{(t.avgAccuracy * 100).toFixed(1)}%</td>
                  <td className="p-3">{t.studentCount}</td>
                  <td className="p-3">{t.masteryLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
