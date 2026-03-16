/**
 * SessionsChart — pure-CSS bar chart for the progress report page.
 *
 * Renders 4 weekly bars (last 30 days). Purple bars for weeks with sessions,
 * light grey for empty weeks. No external charting library.
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 */

const WEEK_LABELS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'] as const;

interface SessionsChartProps {
  /** Session count per week, index 0 = oldest, index 3 = most recent. Length must be 4. */
  weeklyCounts: number[];
  totalSessions: number;
  totalMinutes: number;
}

export default function SessionsChart({
  weeklyCounts,
  totalSessions,
  totalMinutes,
}: SessionsChartProps) {
  const maxCount = Math.max(...weeklyCounts, 1); // avoid division by zero

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
        Sessions this month
      </h2>

      {/* Bar chart */}
      <div className="flex items-end gap-3 h-24" aria-label="Weekly sessions bar chart">
        {weeklyCounts.map((count, i) => {
          const heightPct = Math.round((count / maxCount) * 100);
          const hasActivity = count > 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              {/* Bar container — fixed height, bar grows from bottom */}
              <div className="w-full h-20 flex items-end">
                <div
                  className={[
                    'w-full rounded-t transition-all',
                    hasActivity
                      ? 'bg-[#534AB7]'
                      : 'bg-gray-100 dark:bg-slate-700',
                  ].join(' ')}
                  style={{
                    height: hasActivity ? `${Math.max(heightPct, 8)}%` : '8%',
                    minHeight: '4px',
                  }}
                  role="img"
                  aria-label={`${WEEK_LABELS[i]}: ${count} session${count !== 1 ? 's' : ''}`}
                />
              </div>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {WEEK_LABELS[i]}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        {totalSessions} session{totalSessions !== 1 ? 's' : ''} in last 30 days
        {' · '}~{totalMinutes} minutes total
      </p>
    </article>
  );
}
