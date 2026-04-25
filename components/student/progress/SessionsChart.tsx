/**
 * SessionsChart -- pure-CSS bar chart for the progress report page.
 *
 * Renders 4 bars (period is determined by the caller). Purple bars for
 * periods with sessions, light grey for empty. No external charting library.
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 * - 2026-04-07 | claude | F-STU-033: accept dynamic barLabels + periodLabel
 */

const DEFAULT_LABELS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'] as const;

interface SessionsChartProps {
  /** Session count per bar, index 0 = oldest, index 3 = most recent. Length must be 4. */
  weeklyCounts: number[];
  totalSessions: number;
  totalMinutes: number;
  /** Labels for each bar. Defaults to Week 1-4. */
  barLabels?: [string, string, string, string];
  /** Description of the period shown below the chart, e.g. "last 7 days". */
  periodLabel?: string;
}

export default function SessionsChart({
  weeklyCounts,
  totalSessions,
  totalMinutes,
  barLabels,
  periodLabel = 'last 30 days',
}: SessionsChartProps) {
  const labels = barLabels ?? DEFAULT_LABELS;
  const maxCount = Math.max(...weeklyCounts, 1); // avoid division by zero

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Sessions</h2>

      {/* Bar chart */}
      <div className="flex items-end gap-3 h-24" aria-label="Sessions bar chart">
        {weeklyCounts.map((count, i) => {
          const heightPct = Math.round((count / maxCount) * 100);
          const hasActivity = count > 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              {/* Bar container -- fixed height, bar grows from bottom */}
              <div className="w-full h-20 flex items-end">
                <div
                  className={[
                    'w-full rounded-t transition-all',
                    hasActivity ? 'bg-[#534AB7]' : 'bg-gray-100 dark:bg-slate-700',
                  ].join(' ')}
                  style={{
                    height: hasActivity ? `${Math.max(heightPct, 8)}%` : '8%',
                    minHeight: '4px',
                  }}
                  role="img"
                  aria-label={`${labels[i]}: ${count} session${count !== 1 ? 's' : ''}`}
                />
              </div>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{labels[i]}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        {totalSessions} session{totalSessions !== 1 ? 's' : ''} in {periodLabel}
        {' · '}~{totalMinutes} minutes total
      </p>
    </article>
  );
}
