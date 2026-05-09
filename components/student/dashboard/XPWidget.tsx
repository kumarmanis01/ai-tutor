/**
 * FILE OBJECTIVE:
 * - Render student XP level/progress and a source-wise weekly XP breakdown on the dashboard.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/dashboard/XPWidget.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T15:00:00Z | copilot | render deterministic source-wise XP breakdown rows,
 *                          filter zero-value sources, and add readable fallback labels
 */

'use client'

import { getProgressPercent, getXPToNextLevel, LEVEL_THRESHOLDS, getLevelTierName } from '@/lib/student/xpLevels'

/** Human-readable labels for XP source keys stored in StudentXP.source. */
const XP_SOURCE_LABELS: Record<string, string> = {
  session_correct: 'Correct answers',
  streak_bonus: 'Streak bonus',
  revision_complete: 'Revision cards',
  badge: 'Badge earned',
  session_complete: 'Session completion',
  first_attempt: 'First-attempt bonus',
}

const XP_SOURCE_ORDER = [
  'session_correct',
  'session_complete',
  'first_attempt',
  'streak_bonus',
  'revision_complete',
  'badge',
] as const

function formatUnknownSourceLabel(source: string): string {
  return source
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export interface XPWidgetProps {
  totalXp?: number
  level?: number
  xpThisWeek?: number
  /** F-STU-031 AC-01: XP earned this week broken down by source. */
  xpBySource?: Record<string, number>
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
  xpBySource,
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

  const currentThreshold = (LEVEL_THRESHOLDS[level - 1] ?? 0) as number
  const nextThreshold = (LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) as number
  const xpInBand = totalXp - currentThreshold
  const bandSize = Math.max(1, nextThreshold - currentThreshold)
  const remaining = getXPToNextLevel(totalXp) ?? 0
  const progressPct = getProgressPercent(totalXp)
  const tierName = getLevelTierName(level)
  const xpSourceEntries = Object.entries(xpBySource ?? {}).filter(([, amount]) => amount > 0)
  const xpSourceOrderIndex = new Map<string, number>(XP_SOURCE_ORDER.map((source, index) => [source, index]))
  const sortedXpSourceEntries = xpSourceEntries.sort(([sourceA], [sourceB]) => {
    const indexA = xpSourceOrderIndex.get(sourceA) ?? Number.MAX_SAFE_INTEGER
    const indexB = xpSourceOrderIndex.get(sourceB) ?? Number.MAX_SAFE_INTEGER
    if (indexA !== indexB) return indexA - indexB
    return sourceA.localeCompare(sourceB)
  })

  return (
    <section aria-label="XP progress" className="w-full max-w-full">
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
        {/* Header row: level badge + xp this week */}
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#534AB7]/10 dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300 text-xs font-bold tracking-wide">
            Level {level} · {tierName}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            XP this week: <span className="font-semibold text-gray-700 dark:text-gray-200">{xpThisWeek}</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>{xpInBand} / {bandSize} XP</span>
            <span>{progressPct}%</span>
          </div>
          <div
            className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
            role="progressbar"
            aria-valuenow={xpInBand}
            aria-valuemin={0}
            aria-valuemax={bandSize}
          >
            <div
              className="h-full rounded-full bg-[#534AB7] dark:bg-[#534AB7] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Sub-text */}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {remaining} XP to level {level + 1}
        </p>

        {/* F-STU-031 AC-01: XP source breakdown (shown when data available) */}
        {sortedXpSourceEntries.length > 0 && (
          <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-2.5">
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-wide">
              This week&apos;s XP breakdown
            </p>
            <ul className="space-y-1.5">
              {sortedXpSourceEntries.map(([source, amount]) => (
                <li key={source} className="flex items-center justify-between rounded-md bg-[#534AB7]/10 dark:bg-[#534AB7]/20 px-2.5 py-1">
                  <span className="text-xs text-[#534AB7] dark:text-indigo-300 font-medium">
                    {XP_SOURCE_LABELS[source] ?? formatUnknownSourceLabel(source)}
                  </span>
                  <span className="text-xs font-bold text-[#534AB7] dark:text-indigo-300">+{amount}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

export default XPWidget
