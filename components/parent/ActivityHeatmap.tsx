/**
 * FILE OBJECTIVE:
 * - Render a compact 30-day activity heatmap for parent dashboards.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/activity-heatmap.spec.ts (not yet created)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | created ActivityHeatmap component
 */

interface DayEntry {
  date: string // ISO yyyy-mm-dd
  count: number
}

interface ActivityHeatmapProps {
  days: DayEntry[] // expected length: 30
}

export default function ActivityHeatmap({ days }: ActivityHeatmapProps) {
  // Color scale based on activity count
  function colorClass(count: number) {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
    if (count === 1) return 'bg-green-200 dark:bg-green-800'
    if (count === 2) return 'bg-green-400 dark:bg-green-700'
    return 'bg-green-600 dark:bg-green-500'
  }

  return (
    <div>
      <div className="grid grid-cols-10 gap-1">
        {days.map((d) => (
          <div
            key={d.date}
            title={`${d.date} — ${d.count} session${d.count !== 1 ? 's' : ''}`}
            aria-label={`Activity ${d.date}: ${d.count}`}
            className={`h-6 w-6 rounded-sm ${colorClass(d.count)} flex items-center justify-center`}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
          <span className="ml-1">No activity</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-green-200 dark:bg-green-800" />
          <span className="ml-1">1 session</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-green-400 dark:bg-green-700" />
          <span className="ml-1">2 sessions</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-green-600 dark:bg-green-500" />
          <span className="ml-1">3+ sessions</span>
        </span>
      </div>
    </div>
  )
}
