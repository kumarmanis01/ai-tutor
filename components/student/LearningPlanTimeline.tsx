/**
 * FILE OBJECTIVE:
 * - Visual week-by-week learning plan timeline with chapter sequence, session counts,
 *   and up/down reorder controls for UPCOMING items within a week.
 * - AC-04 (F-STU-003): calendar view + chapter sequence + estimated session count.
 * - AC-06 (F-STU-003): student can manually reorder topics within a week (up/down buttons).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/LearningPlanTimeline.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | created -- AC-04 + AC-06 (F-STU-003) timeline + reorder UI
 */
'use client'

import React, { useState, useCallback } from 'react'
import type { TimelineResponse, TimelineItem } from '@/app/api/student/learning-plan/timeline/route'
import { logger } from '@/lib/logger'

const STATUS_STYLES: Record<TimelineItem['status'], string> = {
  COMPLETED: 'bg-[#EAF3DE] text-[#1D9E75] border-[#1D9E75]',
  IN_PROGRESS: 'bg-[#EEEDFE] text-[#534AB7] border-[#534AB7]',
  UPCOMING: 'bg-muted text-muted-foreground border-border',
  DEFERRED: 'bg-[#FCEBEB] text-[#E24B4A] border-[#E24B4A]',
}

const STATUS_LABELS: Record<TimelineItem['status'], string> = {
  COMPLETED: 'Done',
  IN_PROGRESS: 'In progress',
  UPCOMING: 'Upcoming',
  DEFERRED: 'Deferred',
}

function formatWeekDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface WeekCardProps {
  week: TimelineResponse['weeks'][number]
  onMoveItem: (itemId: string, direction: 'prev' | 'next') => Promise<void>
  isCurrentWeek: boolean
}

function WeekCard({ week, onMoveItem, isCurrentWeek }: WeekCardProps) {
  const [movingId, setMovingId] = useState<string | null>(null)

  const handleMove = useCallback(
    async (item: TimelineItem, direction: 'prev' | 'next') => {
      setMovingId(item.id)
      try {
        await onMoveItem(item.id, direction)
      } finally {
        setMovingId(null)
      }
    },
    [onMoveItem],
  )

  const upcomingItems = week.items.filter((i) => i.status === 'UPCOMING')

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isCurrentWeek
          ? 'border-[#534AB7] bg-[#EEEDFE]/40 dark:bg-[#534AB7]/10'
          : 'border-border bg-card dark:bg-slate-800/40'
      }`}
    >
      {/* Week header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span
            className={`text-xs font-semibold uppercase tracking-wide ${
              isCurrentWeek ? 'text-[#534AB7]' : 'text-muted-foreground'
            }`}
          >
            {isCurrentWeek ? 'Current week' : `Week ${week.weekNumber}`}
          </span>
          <p className="text-sm text-muted-foreground">
            From {formatWeekDate(week.startDate)}
          </p>
        </div>
        {/* Chapter summary badges */}
        <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
          {week.chapterSummary.map((cs) => (
            <span
              key={cs.chapterName}
              className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
              title={`${cs.sessionCount} session${cs.sessionCount !== 1 ? 's' : ''}`}
            >
              {cs.chapterName} ×{cs.sessionCount}
            </span>
          ))}
        </div>
      </div>

      {/* Item list */}
      <ol className="space-y-2">
        {week.items.map((item, idx) => {
          const isFirst = idx === 0
          const isLast = idx === week.items.length - 1
          const canReorder = item.status === 'UPCOMING' && !item.isMandatory
          const prevItem = week.items[idx - 1]
          const nextItem = week.items[idx + 1]
          const canMoveUp = canReorder && !isFirst && prevItem?.status === 'UPCOMING'
          const canMoveDown = canReorder && !isLast && nextItem?.status === 'UPCOMING'

          return (
            <li
              key={item.id}
              className="flex items-center gap-2 group"
            >
              {/* Order number */}
              <span className="shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-medium">
                {item.orderInWeek + 1}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.conceptName}</p>
                <p className="text-xs text-muted-foreground truncate">{item.chapterName}</p>
              </div>

              {/* Status badge */}
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[item.status]}`}
              >
                {STATUS_LABELS[item.status]}
              </span>

              {/* AC-06: Reorder buttons -- only shown for UPCOMING, non-mandatory items */}
              {canReorder && (
                <div className="shrink-0 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    aria-label={`Move "${item.conceptName}" up`}
                    disabled={!canMoveUp || movingId !== null}
                    onClick={() => handleMove(item, 'prev')}
                    className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded border border-border bg-card hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                  >
                    {movingId === item.id ? '…' : '↑'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Move "${item.conceptName}" down`}
                    disabled={!canMoveDown || movingId !== null}
                    onClick={() => handleMove(item, 'next')}
                    className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded border border-border bg-card hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                  >
                    {movingId === item.id ? '…' : '↓'}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {/* Reorder hint for weeks with reorderable items */}
      {upcomingItems.length > 1 && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Tap ↑↓ on upcoming topics to change your study order.
        </p>
      )}
    </div>
  )
}

// ─── Progress bar ────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div
        className="h-2 rounded-full bg-[#534AB7] transition-all duration-300"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

interface LearningPlanTimelineProps {
  initialData: TimelineResponse
}

export function LearningPlanTimeline({ initialData }: LearningPlanTimelineProps) {
  const [data, setData] = useState<TimelineResponse>(initialData)
  const [error, setError] = useState<string | null>(null)

  // Determine which week number is "current" (first week with any UPCOMING item)
  const currentWeekNumber =
    data.weeks.find((w) => w.items.some((i) => i.status === 'UPCOMING' || i.status === 'IN_PROGRESS'))
      ?.weekNumber ?? null

  const handleMoveItem = useCallback(
    async (itemId: string, direction: 'prev' | 'next') => {
      setError(null)
      try {
        const resp = await fetch(`/api/student/learning-plan/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'move', direction }),
        })
        if (!resp.ok) {
          const json = await resp.json().catch(() => ({}))
          setError((json as { error?: string }).error ?? 'Could not reorder — please try again.')
          return
        }
        // Optimistically swap the items in local state
        setData((prev) => {
          const weeks = prev.weeks.map((w) => {
            const srcIdx = w.items.findIndex((i) => i.id === itemId)
            if (srcIdx === -1) return w
            const tgtIdx = direction === 'next' ? srcIdx + 1 : srcIdx - 1
            if (tgtIdx < 0 || tgtIdx >= w.items.length) return w
            const items = [...w.items]
            ;[items[srcIdx], items[tgtIdx]] = [items[tgtIdx], items[srcIdx]]
            // Reassign orderInWeek to match new positions
            const reindexed = items.map((item, i) => ({ ...item, orderInWeek: i }))
            return { ...w, items: reindexed }
          })
          return { ...prev, weeks }
        })
      } catch (err) {
        logger.warn('Could not reorder item', { event: 'learningPlan.move.failed', error: String(err), itemId });
        setError('Could not reorder — tap to retry.')
      }
    },
    [],
  )

  const daysToExam = data.examDate
    ? Math.ceil((new Date(data.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="space-y-6">
      {/* Plan summary header */}
      <div className="bg-card dark:bg-slate-800/50 rounded-xl p-4 border border-border/30 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Study Plan Timeline</h2>
          {daysToExam !== null && daysToExam > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-[#FAEEDA] text-amber-800 font-medium">
              {daysToExam} days to exam
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{data.totalConcepts} topics</span>
          <span>·</span>
          <span>{data.totalWeeks} weeks</span>
          <span>·</span>
          <span>{data.weeklyGoal} sessions/week</span>
        </div>

        <ProgressBar value={data.completedConcepts} max={data.totalConcepts} />
        <p className="text-xs text-muted-foreground text-right">
          {data.completedConcepts} of {data.totalConcepts} topics done
        </p>
      </div>

      {/* Inline error */}
      {error && (
        <div className="p-3 rounded-lg bg-[#FCEBEB] border border-red-200 text-sm text-[#E24B4A]">
          {error}
        </div>
      )}

      {/* Week cards */}
      {data.weeks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">Your plan is being prepared…</p>
          <p className="text-sm mt-1">Check back in a moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.weeks.map((week) => (
            <WeekCard
              key={week.weekNumber}
              week={week}
              onMoveItem={handleMoveItem}
              isCurrentWeek={week.weekNumber === currentWeekNumber}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default LearningPlanTimeline
