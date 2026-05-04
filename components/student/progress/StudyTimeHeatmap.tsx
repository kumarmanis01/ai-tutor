/**
 * StudyTimeHeatmap -- F-STU-033 AC-01
 *
 * Shows last 28 days of study activity as a 4-week x 7-day colour grid.
 * Each cell is one calendar day; colour intensity = minutes studied that day.
 * Pure CSS, no charting library.
 *
 * Colour bands:
 *   0 min        -> bg-gray-100  dark:bg-slate-700  (no activity)
 *   1-20 min     -> bg-[#EEEDFE] (lightest)
 *   21-40 min    -> bg-[#534AB7]/40
 *   41+ min      -> bg-[#534AB7]  (full)
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

  // Build grid: weeks columns x 7 rows (Mon=0 ... Sun=6)
  // Anchor: today. Walk back (weeks*7 - 1) days to fill the grid.
  const totalDays = weeks * 7;
  const cells: { date: string; minutes: number; weekIdx: number; dayIdx: number }[] = [];

  const now = new Date();
  // Sunday = 0 in JS. Shift so Monday = 0.
  const todayDow = (now.getDay() + 6) % 7; // Mon=0 Sun=6

  // Pad so the last column ends on today's day-of-week.
  // We fill columns left to right, rows top to bottom (Mon=row 0 ... Sun=row 6).
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0
    // Column index: 0 = leftmost week. We have `weeks` columns.
    const absPos = totalDays - 1 - i; // 0 = (totalDays-1) days ago
    const weekIdx = Math.floor((absPos + (7 - (todayDow + 1))) % totalDays / 7);
    cells.push({
      date: dateStr,
      minutes: minutesByDate.get(dateStr) ?? 0,
      weekIdx: Math.floor(absPos / 7),
      dayIdx: dayOfWeek,
    });
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
