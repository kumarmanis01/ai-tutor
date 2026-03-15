'use client'

/**
 * StreakWidget — Task 30
 *
 * Shows the student's current streak with a 7-day mini calendar.
 * Designed as a popover triggered from the Topbar streak badge.
 *
 * States: loading skeleton | error (tap to retry) | empty (streak=0) | populated
 * Copy rule: never use "broke", "missed", "failed", "lost".
 * Forward-looking tone only.
 */

import React, { useEffect, useRef } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type TopbarStats = {
  streak: number
  level: number
  shieldAvailable: boolean
}

/** Returns the last 7 calendar dates as YYYY-MM-DD strings, ending with today (UTC). */
function lastSevenDays(now: Date): string[] {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

/** Short day label (Mon–Sun) for a YYYY-MM-DD date string. */
function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]
}

type ActivityData = {
  activeDates: string[] // YYYY-MM-DD strings of days with a qualifying session
}

type Props = {
  /** Called when the user taps outside or a close action fires */
  onClose: () => void
}

export default function StreakWidget({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Stats come from the same endpoint Topbar already fetches (60s SWR cache).
  const { data: stats, error: statsError, mutate: mutateStats } = useSWR<TopbarStats>(
    '/api/student/topbar-stats',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )

  // Lightweight endpoint: dates that had a qualifying session in the last 7 days.
  const { data: activity, error: actError, mutate: mutateActivity } = useSWR<ActivityData>(
    '/api/student/streak-activity',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  const loading = !stats && !statsError
  const error = !!statsError || !!actError

  const streak = stats?.streak ?? 0
  const shieldAvailable = stats?.shieldAvailable ?? false

  const todayStr = new Date().toISOString().split('T')[0]
  const calendarDays = lastSevenDays(new Date())
  const activeSet = new Set<string>(activity?.activeDates ?? [])

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        ref={ref}
        className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-slate-700 shadow-xl p-4 animate-pulse"
        role="status"
        aria-label="Loading streak"
      >
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/2 mb-4" />
        <div className="flex gap-1.5 mb-4">
          {Array(7).fill(0).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5" />
              <div className="w-full aspect-square rounded-xl bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        ref={ref}
        className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-slate-700 shadow-xl p-4 text-center"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Couldn&apos;t load — tap to retry
        </p>
        <button
          className="text-sm font-semibold text-[#534AB7] min-h-[44px] min-w-[44px] px-4"
          onClick={() => { void mutateStats(); void mutateActivity() }}
        >
          Retry
        </button>
      </div>
    )
  }

  // ── Empty state (streak = 0) ─────────────────────────────────────────────────
  if (streak === 0) {
    return (
      <div
        ref={ref}
        className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-slate-700 shadow-xl p-4"
      >
        <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Start your streak today!
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Start a new streak today — your best is still ahead.
        </p>
        {/* 7-day calendar — all grey */}
        <div className="flex gap-1.5 mb-3">
          {calendarDays.map((date) => (
            <div key={date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{dayLabel(date)}</span>
              <div
                className={[
                  'w-full aspect-square rounded-xl',
                  date === todayStr
                    ? 'bg-gray-100 dark:bg-gray-800 ring-2 ring-[#1D9E75] ring-offset-1 ring-offset-white dark:ring-offset-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800',
                ].join(' ')}
              />
            </div>
          ))}
        </div>
        <a
          href="/dashboard"
          className="block text-center text-sm font-semibold text-white bg-[#534AB7] rounded-xl py-3 min-h-[44px] flex items-center justify-center"
          onClick={onClose}
        >
          Start today&apos;s lesson
        </a>
      </div>
    )
  }

  // ── Populated state ─────────────────────────────────────────────────────────
  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-slate-700 shadow-xl p-4"
      role="dialog"
      aria-label="Streak details"
    >
      {/* Header: streak count + shield */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl leading-none">🔥</span>
        <span className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
          {streak}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {streak === 1 ? 'day' : 'days'}
        </span>
        {shieldAvailable && (
          <span
            className="ml-auto text-lg leading-none"
            title="Streak shield available this month"
            aria-label="Streak shield available"
          >
            🛡️
          </span>
        )}
      </div>

      {/* 7-day mini calendar */}
      <div className="flex gap-1.5 mb-3">
        {calendarDays.map((date) => {
          const isToday = date === todayStr
          const isActive = activeSet.has(date)
          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-1">
              <span
                className={[
                  'text-[10px]',
                  isToday
                    ? 'text-[#534AB7] dark:text-indigo-400 font-semibold'
                    : 'text-gray-400 dark:text-gray-500',
                ].join(' ')}
              >
                {dayLabel(date)}
              </span>
              <div
                className={[
                  'w-full aspect-square rounded-xl transition-colors',
                  isActive
                    ? 'bg-[#534AB7] dark:bg-indigo-600'
                    : isToday
                    ? 'bg-gray-100 dark:bg-gray-800 ring-2 ring-[#1D9E75] ring-offset-1 ring-offset-white dark:ring-offset-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800',
                ].join(' ')}
              />
            </div>
          )
        })}
      </div>

      {/* Best streak */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Your best streak: <span className="font-semibold text-gray-700 dark:text-gray-200">{streak} days</span>
      </p>

      {/* Shield info */}
      {shieldAvailable && (
        <p className="text-xs text-[#534AB7] dark:text-indigo-400 text-center mt-1">
          🛡️ Shield ready — keeps your streak if you need a day off
        </p>
      )}
    </div>
  )
}
