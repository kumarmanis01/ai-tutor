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
  const panelClass = 'bg-white dark:bg-slate-900 border border-[#D3D1C7] dark:border-slate-700 rounded-2xl p-5';

  return (
    <article className={panelClass}>
      {sessions.length === 0 ? (
        <div>
          <p className="text-sm text-[#888780] dark:text-gray-400 mb-3">
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
          <table className="w-full border-collapse min-w-[280px]">
            <thead>
              <tr>
                <th className="text-left pb-3 pr-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#888780] dark:text-gray-500">Date</th>
                <th className="text-left pb-3 pr-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#888780] dark:text-gray-500">Topic</th>
                <th className="text-right pb-3 pr-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#888780] dark:text-gray-500">Score</th>
                <th className="text-right pb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#888780] dark:text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[#D3D1C7] dark:border-slate-700"
                >
                  <td className="py-3 pr-3 text-[#888780] dark:text-gray-400 whitespace-nowrap text-[13px]">
                    {formatDate(row.date)}
                  </td>
                  <td className="py-3 pr-3 text-[#2C2C2A] dark:text-gray-100 text-[13px] max-w-[140px] truncate">
                    {row.topicName}
                  </td>
                  <td className="py-3 pr-3 text-right whitespace-nowrap">
                    {row.score !== null ? (
                      <span
                        className={[
                          'text-[13px] font-semibold font-mono',
                          row.score >= 70
                            ? 'text-[#1D9E75]'
                            : row.score >= 40
                            ? 'text-[#BA7517]'
                            : 'text-[#E24B4A]',
                        ].join(' ')}
                      >
                        {row.score}%
                      </span>
                    ) : (
                      <span className="text-[#B4B2A9] dark:text-gray-600 text-[13px]">--</span>
                    )}
                  </td>
                  <td className="py-3 text-right text-[13px] text-[#888780] dark:text-gray-500 whitespace-nowrap">
                    {row.durationMin > 0 ? `${row.durationMin} min` : '--'}
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
