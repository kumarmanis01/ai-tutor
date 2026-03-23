'use client';

import useSWR from 'swr';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminStudentLearningDrilldownPage() {
  const params = useParams();
  const studentId = params?.studentId as string | undefined;

  const { data, error, isLoading } = useSWR(
    studentId ? `/api/admin/student-learning/students/${encodeURIComponent(studentId)}` : null,
    fetcher
  );

  if (!studentId) return <div className="p-6">Missing student ID</div>;
  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error || !data) return <div className="p-6">Failed to load student or not found.</div>;

  const s = data as {
    studentId: string;
    email: string | null;
    name: string | null;
    board: string | null;
    grade: string | null;
    sessionsCompleted7d: number;
    lastActiveAt: string | null;
    homeworkPending: number;
    weakTopicCount: number;
    recentSessions: { sessionId: string; topicName: string; completedAt: string | null }[];
    weakTopics: { topicId: string; topicName: string; mastery: number; practiceCount: number }[];
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/student-learning" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
          ← Back to list
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Student: {s.name || s.email || s.studentId}
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Sessions (7d)</div>
          <div className="text-xl font-bold">{s.sessionsCompleted7d}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Last active</div>
          <div className="text-sm">{s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : '--'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Homework pending</div>
          <div className="text-xl font-bold">{s.homeworkPending}</div>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Weak topics</div>
          <div className="text-xl font-bold">{s.weakTopicCount}</div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Recent sessions</h2>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Topic</th>
                <th className="p-3 text-left font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {s.recentSessions?.length === 0 && (
                <tr><td colSpan={2} className="p-4 text-center text-gray-500">No recent sessions</td></tr>
              )}
              {s.recentSessions?.map((r: { sessionId: string; topicName: string; completedAt: string | null }) => (
                <tr key={r.sessionId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3">{r.topicName}</td>
                  <td className="p-3">{r.completedAt ? new Date(r.completedAt).toLocaleString() : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Weak topics (mastery &lt; 40%, 5+ practice)</h2>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium">Topic</th>
                <th className="p-3 text-left font-medium">Mastery</th>
                <th className="p-3 text-left font-medium">Practice count</th>
              </tr>
            </thead>
            <tbody>
              {s.weakTopics?.length === 0 && (
                <tr><td colSpan={3} className="p-4 text-center text-gray-500">No weak topics</td></tr>
              )}
              {s.weakTopics?.map((w: { topicId: string; topicName: string; mastery: number; practiceCount: number }) => (
                <tr key={w.topicId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3">{w.topicName}</td>
                  <td className="p-3">{(w.mastery * 100).toFixed(0)}%</td>
                  <td className="p-3">{w.practiceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
