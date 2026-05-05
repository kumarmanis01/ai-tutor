/**
 * ParentProgressDetail -- T39
 *
 * Read-only. No edit controls, no interaction, no transcript content.
 * Mobile-first, dark variants.
 * Includes benchmarking opt-in toggle for anonymous peer percentile display (F-PAR-011 AC-04).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/ParentProgressDetail.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | T39 original
 * - 2026-05-04T00:00:00Z | copilot | F-PAR-011 AC-04: benchmarking opt-in toggle + peerPercentile display
 */

'use client'

import { useState, useEffect } from 'react'
import SubjectReadinessCard from '@/components/student/dashboard/SubjectReadinessCard'
import ActivityHeatmap from '@/components/parent/ActivityHeatmap'
import { LOCAL_STRINGS } from '@/lib/parent/dashboardHelpers'

const BENCHMARKING_OPTIN_KEY = 'parent_benchmarking_optin'

interface SessionRow {
  id: string
  date: string        // ISO
  topicName: string
  subjectName: string
  chapterName: string
  durationMinutes: number | null
  completed: boolean
  topicId?: string
  masteryAfter?: number | null
}

interface ReadinessRow {
  subjectId: string
  subjectName: string
  score: number
  /** Anonymous peer percentile for this subject. null = not computed or opted out. */
  peerPercentile?: number | null
}

interface LearningPlanSummary {
  subjectName: string
  totalConcepts: number
  completedConcepts: number
  progressPercent: number
  nextConceptName: string | null
}

interface ParentProgressDetailProps {
  studentName: string
  grade: string
  board: string
  sessions: SessionRow[]
  readiness: ReadinessRow[]
  heatmapDays?: { date: string; count: number }[]
  /** F-PAR-002 AC-03: read-only AI learning plan summary */
  learningPlan?: LearningPlanSummary | null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export default function ParentProgressDetail({
  studentName,
  grade,
  board,
  sessions,
  readiness,
  heatmapDays,
  learningPlan,
}: ParentProgressDetailProps) {
  const subtitle = [grade, board].filter(Boolean).join(' · ')

  // ── Benchmarking opt-in (F-PAR-011 AC-04) ───────────────────────────────
  // Reads/persists preference to localStorage (same key as ParentDashboardClient).
  const [benchmarkingOptIn, setBenchmarkingOptIn] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(BENCHMARKING_OPTIN_KEY) === '1'
      setBenchmarkingOptIn(stored)
    } catch {
      // localStorage unavailable (e.g. private browsing restrictions) -- stay opted out
    }
  }, [])

  function toggleBenchmarking() {
    const next = !benchmarkingOptIn
    setBenchmarkingOptIn(next)
    try {
      localStorage.setItem(BENCHMARKING_OPTIN_KEY, next ? '1' : '0')
    } catch {
      // localStorage unavailable -- silently ignore, preference is in-memory only
    }
  }

  const strings = LOCAL_STRINGS['en']

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <a
          href="/parent/dashboard"
          className="mb-3 inline-flex items-center gap-1 text-sm text-[#534AB7] hover:underline dark:text-indigo-400"
        >
          ← My children
        </a>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">{studentName}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>

      {/* ── Subject readiness ─────────────────────────────────────────── */}
      {readiness.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-gray-400">
              Exam readiness by subject
            </h2>
            {/* ── Anonymous benchmarking opt-in toggle (F-PAR-011 AC-04) ── */}
            <button
              type="button"
              onClick={toggleBenchmarking}
              aria-pressed={benchmarkingOptIn}
              className={[
                'min-h-[44px] min-w-[44px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                benchmarkingOptIn
                  ? 'bg-[#534AB7] text-white dark:bg-indigo-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-[#EEEDFE] hover:text-[#534AB7] dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-indigo-950',
              ].join(' ')}
            >
              {strings.benchmarkingOptInLabel}
            </button>
          </div>
          <div className="space-y-2">
            {readiness.map((r) => (
              <div key={r.subjectId}>
                <SubjectReadinessCard
                  subjectName={r.subjectName}
                  score={r.score}
                  subjectId={r.subjectId}
                />
                {/* Peer percentile line -- only shown when opted in and data available */}
                {benchmarkingOptIn && r.peerPercentile !== null && r.peerPercentile !== undefined && (
                  <p className="mt-0.5 pl-1 text-xs text-gray-500 dark:text-gray-400">
                    {strings.benchmarkingCopy.replace('{pct}', String(r.peerPercentile))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── AI Learning Plan summary (F-PAR-002 AC-03: read-only view) ──── */}
      {learningPlan && (
        <section className="rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-2 text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-gray-400">
            AI Learning Plan
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">{learningPlan.subjectName}</p>
          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{learningPlan.completedConcepts} of {learningPlan.totalConcepts} topics completed</span>
              <span>{learningPlan.progressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-2 rounded-full bg-[#534AB7]"
                style={{ width: `${Math.min(learningPlan.progressPercent, 100)}%` }}
              />
            </div>
          </div>
          {learningPlan.nextConceptName && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">Next topic:</span> {learningPlan.nextConceptName}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            To suggest a topic focus, go to{' '}
            <a href="/parent/settings" className="underline text-[#534AB7] dark:text-indigo-400">
              parent settings
            </a>
            .
          </p>
        </section>
      )}

      {/* ── Activity heatmap (30 days) ─────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-gray-400">
          Activity -- last 30 days
        </h2>
        {heatmapDays && heatmapDays.length > 0 ? (
          <ActivityHeatmap days={heatmapDays} />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No activity in the last 30 days.</p>
        )}
      </section>

      {/* ── Last 10 sessions ─────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-gray-400">
          Last 10 sessions
        </h2>

        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No sessions in the last 7 days.</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-900">
            {sessions.map((s) => {
              const mastery = s.masteryAfter ?? null
              const masteryLabel = mastery === null ? null : mastery >= 0.7 ? 'Positive' : mastery >= 0.4 ? 'Neutral' : 'Needs revision'
              const masteryClasses = mastery === null ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' : mastery >= 0.7 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : mastery >= 0.4 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
              return (
                <div key={s.id} className="flex items-start justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
                      {s.topicName || '--'}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {[s.subjectName, s.chapterName].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(s.date)}</p>
                    {s.durationMinutes !== null && (
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                        {s.durationMinutes} min
                      </p>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-2">
                      {s.completed && (
                        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                          Done
                        </span>
                      )}
                      {masteryLabel && (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${masteryClasses}`}>
                          {masteryLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

    </main>
  )
}
