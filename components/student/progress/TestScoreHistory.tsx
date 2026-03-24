/**
 * TestScoreHistory -- table of last 10 completed sessions for the progress page.
 *
 * Columns: Date | Topic | Score | Time spent
 * Score of null (meta.score not set) renders as "--".
 * Empty state includes a CTA to start the first session.
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 */

import Link from 'next/link';

export interface SessionRow {
  id: string;
  date: string;        // ISO string
  topicName: string;
  score: number | null; // 0-100, or null if not recorded
  durationMin: number;
}

interface TestScoreHistoryProps {
  sessions: SessionRow[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export default function TestScoreHistory({ sessions }: TestScoreHistoryProps) {
  return (
    <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
        Session history
      </h2>

      {sessions.length === 0 ? (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Complete your first session to see scores here.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center min-h-[44px] text-sm font-medium text-[#534AB7] dark:text-[#9B96E0] underline"
          >
            Go to dashboard →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm border-collapse min-w-[280px]">
            <thead>
              <tr className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="text-left pb-2 pr-3 font-medium">Date</th>
                <th className="text-left pb-2 pr-3 font-medium">Topic</th>
                <th className="text-right pb-2 pr-3 font-medium">Score</th>
                <th className="text-right pb-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-gray-100 dark:border-slate-700"
                >
                  <td className="py-2.5 pr-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                    {formatDate(row.date)}
                  </td>
                  <td className="py-2.5 pr-3 text-gray-800 dark:text-gray-100 max-w-[120px] truncate">
                    {row.topicName}
                  </td>
                  <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                    {row.score !== null ? (
                      <span
                        className={
                          row.score >= 70
                            ? 'text-[#1D9E75] font-semibold'
                            : row.score >= 40
                            ? 'text-[#BA7517] font-semibold'
                            : 'text-[#E24B4A] font-semibold'
                        }
                      >
                        {row.score}%
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">--</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {row.durationMin} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
