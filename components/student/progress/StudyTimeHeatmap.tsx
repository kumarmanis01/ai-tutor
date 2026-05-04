/**
 * FILE OBJECTIVE:
 * - Render a calendar-aligned study-time heatmap for the last N weeks.
 * - Show one cell per weekday with intensity bands based on minutes studied.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/progress/StudyTimeHeatmap.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-04T00:00:00Z | copilot | add required file header and align columns to Monday-Sunday calendar weeks
 */

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface HeatmapDay {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Total study minutes for this day */
  minutes: number;
}

interface StudyTimeHeatmapProps {
  days: HeatmapDay[];
  /** Number of week columns to show. Default 4. */
  weeks?: number;
}

function cellBg(minutes: number): string {
  if (minutes === 0) return 'bg-gray-100 dark:bg-slate-700';
  if (minutes <= 20) return 'bg-[#EEEDFE] dark:bg-[#534AB7]/25';
  if (minutes <= 40) return 'bg-[#534AB7]/40 dark:bg-[#534AB7]/55';
  return 'bg-[#534AB7] dark:bg-[#534AB7]';
}

export default function StudyTimeHeatmap({ days, weeks = 4 }: StudyTimeHeatmapProps) {
  const minutesByDate = new Map<string, number>(days.map((d) => [d.date, d.minutes]));

  // Build grid: weeks columns x 7 rows (Mon=0 ... Sun=6), aligned to calendar weeks.
  const cells: { date: string; minutes: number; weekIdx: number; dayIdx: number; isFuture: boolean }[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDow = (today.getDay() + 6) % 7; // Mon=0 Sun=6

  // Monday of the left-most rendered week.
  const gridStart = new Date(today);
  gridStart.setDate(today.getDate() - todayDow - (weeks - 1) * 7);

  for (let weekIdx = 0; weekIdx < weeks; weekIdx += 1) {
    for (let dayIdx = 0; dayIdx < 7; dayIdx += 1) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + weekIdx * 7 + dayIdx);
      const dateStr = d.toISOString().slice(0, 10);
      const isFuture = d.getTime() > today.getTime();
      cells.push({
        date: dateStr,
        minutes: isFuture ? 0 : (minutesByDate.get(dateStr) ?? 0),
        weekIdx,
        dayIdx,
        isFuture,
      });
    }
  }

  // Build week columns array (length=weeks), each an array of 7 day cells
  const grid: (typeof cells[0] | null)[][] = Array.from({ length: weeks }, () =>
    Array.from({ length: 7 }, () => null),
  );
  for (const cell of cells) {
    if (cell.weekIdx < weeks) {
      grid[cell.weekIdx][cell.dayIdx] = cell;
    }
  }

  const totalMinutes = days.reduce((s, d) => s + d.minutes, 0);
  const activeDays = days.filter((d) => d.minutes > 0).length;

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
        Study time -- last {weeks} weeks
      </h2>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        {activeDays} active day{activeDays !== 1 ? 's' : ''} &middot; ~{totalMinutes} minutes total
      </p>

      <div className="flex gap-1.5" aria-label="Study time heatmap">
        {/* Day labels column */}
        <div className="flex flex-col gap-1 pt-0.5" aria-hidden="true">
          {DAY_LABELS.map((label) => (
            <div key={label} className="h-5 flex items-center">
              <span className="text-[9px] text-gray-400 dark:text-gray-500 w-6 leading-none">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Week columns */}
        {grid.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-1 flex-1">
            {week.map((cell, dIdx) => {
              if (!cell) {
                return (
                  <div
                    key={dIdx}
                    className="h-5 rounded-sm bg-transparent"
                    aria-hidden="true"
                  />
                );
              }
              if (cell.isFuture) {
                return (
                  <div
                    key={dIdx}
                    className="h-5 rounded-sm bg-transparent"
                    aria-hidden="true"
                  />
                );
              }
              const label = `${cell.date}: ${cell.minutes} min`;
              return (
                <div
                  key={dIdx}
                  title={label}
                  aria-label={label}
                  className={`h-5 rounded-sm transition-colors ${cellBg(cell.minutes)}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3" aria-hidden="true">
        <span className="text-[9px] text-gray-400 dark:text-gray-500">Less</span>
        {['bg-gray-100 dark:bg-slate-700', 'bg-[#EEEDFE] dark:bg-[#534AB7]/25', 'bg-[#534AB7]/40 dark:bg-[#534AB7]/55', 'bg-[#534AB7] dark:bg-[#534AB7]'].map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
        ))}
        <span className="text-[9px] text-gray-400 dark:text-gray-500">More</span>
      </div>
    </article>
  );
}
