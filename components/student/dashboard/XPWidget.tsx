'use client'

export interface XPWidgetProps {
  totalXp?: number
  level?: number
  xpThisWeek?: number
  loading?: boolean
  error?: boolean
}

function XPWidgetSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full mb-2 animate-pulse" />
      <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    </div>
  )
}

export function XPWidget({
  totalXp = 0,
  level = 1,
  xpThisWeek = 0,
  loading = false,
  error = false,
}: XPWidgetProps) {
  if (loading) return <XPWidgetSkeleton />

  if (error) {
    return (
      <section aria-label="XP progress" className="w-full max-w-full">
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Couldn&apos;t load XP</p>
        </div>
      </section>
    )
  }

  const threshold = Math.max(1, level * level * 50)
  const xpInBand = totalXp % threshold
  const remaining = threshold - xpInBand
  const progressPct = Math.min(100, Math.round((xpInBand / threshold) * 100))

  return (
    <section aria-label="XP progress" className="w-full max-w-full">
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
        {/* Header row: level badge + xp this week */}
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold tracking-wide">
            Level {level}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            XP this week: <span className="font-semibold text-gray-700 dark:text-gray-200">{xpThisWeek}</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>{xpInBand} / {threshold} XP</span>
            <span>{progressPct}%</span>
          </div>
          <div
            className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
            role="progressbar"
            aria-valuenow={xpInBand}
            aria-valuemin={0}
            aria-valuemax={threshold}
          >
            <div
              className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Sub-text */}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {remaining} XP to level {level + 1}
        </p>
      </div>
    </section>
  )
}

export default XPWidget
