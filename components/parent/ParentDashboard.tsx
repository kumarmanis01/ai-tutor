/**
 * FILE OBJECTIVE:
 * - Parent dashboard card view: shows all linked children with stats, readiness,
 *   and exam countdown. Multiple children rendered as horizontal tabs (F-PAR-010 AC-03).
 *   Exam countdown shown per child when examDate is set (F-PAR-010 AC-02).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/ParentDashboard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | added dual timezone display per child
 * - 2026-05-04T00:00:00Z | copilot | F-PAR-010 AC-02/AC-03: exam countdown + horizontal tabs
 */

'use client'

import { useState } from 'react'
import SubjectReadinessCard from '@/components/student/dashboard/SubjectReadinessCard'
import Link from 'next/link'

const FAMILY_MAX_CHILDREN = 3

interface ChildReadiness {
  subjectId: string
  subjectName: string
  score: number
}

interface ChildData {
  studentId: string
  name: string
  grade: string
  board: string
  streak: number
  sessionsThisWeek: number
  readiness: ChildReadiness[]
  timezone?: string | null
  /** ISO string of the student's upcoming exam date (F-PAR-010 AC-02). null when not set. */
  examDate?: string | null
}

interface ParentDashboardProps {
  childrenData: ChildData[]
  parentTimezone?: string | null
}

/** Compute days remaining to an exam date. Returns null when date is unset or in the past. */
function daysToExam(examDateIso: string | null | undefined): number | null {
  if (!examDateIso) return null
  const days = Math.ceil((new Date(examDateIso).getTime() - Date.now()) / 86_400_000)
  return days > 0 ? days : null
}

/** Render timezone line for a child card. */
function timezoneLabel(parentTz: string | null | undefined, studentTz: string | null | undefined): string {
  const pTz = parentTz ?? null
  const sTz = studentTz ?? null
  if (pTz && sTz) {
    if (pTz === sTz) return `Times shown: ${pTz}`
    return `Times shown: ${pTz} • Student: ${sTz}`
  }
  if (pTz) return `Times shown: ${pTz}`
  if (sTz) return `Times shown: Student: ${sTz}`
  return 'Times shown: your timezone'
}

export default function ParentDashboard({ childrenData, parentTimezone }: ParentDashboardProps) {
  // ── Tab state (F-PAR-010 AC-03: horizontal child tabs) ──────────────────
  const [activeIdx, setActiveIdx] = useState(0)
  // Clamp active index in case childrenData shrinks between renders
  const safeActiveIdx = Math.min(activeIdx, Math.max(0, childrenData.length - 1))

  // ── Empty state ──────────────────────────────────────────────────────────
  if (childrenData.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-4xl">👨‍👩‍👧</p>
        <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
          No children linked yet
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Ask your child to share an invite link from the Spinzy app,
          then tap it to connect your accounts.
        </p>
        <Link
          href="/parent/link-child"
          className="mt-5 inline-block rounded-lg bg-[#534AB7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3C3489] dark:bg-[#534AB7] dark:hover:bg-indigo-400"
        >
          Link a child
        </Link>
      </main>
    )
  }

  const child = childrenData[safeActiveIdx]
  const examDays = daysToExam(child.examDate)

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">
        My children
      </h1>

      {/* ── Horizontal tab strip (F-PAR-010 AC-03) -- visible only for 2+ children ── */}
      {childrenData.length > 1 && (
        <nav
          aria-label="Children"
          className="flex gap-2 overflow-x-auto pb-1 -mb-1"
        >
          {childrenData.map((c, i) => (
            <button
              key={c.studentId}
              type="button"
              onClick={() => setActiveIdx(i)}
              aria-current={i === safeActiveIdx ? 'page' : undefined}
              className={[
                'shrink-0 min-h-[44px] min-w-[44px] rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                i === safeActiveIdx
                  ? 'bg-[#534AB7] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-[#EEEDFE] hover:text-[#534AB7] dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-indigo-950 dark:hover:text-indigo-300',
              ].join(' ')}
            >
              {c.name}
            </button>
          ))}
        </nav>
      )}

      {/* ── Link another child action ─────────────────────────────────────── */}
      <div className="flex justify-end">
        {childrenData.length < FAMILY_MAX_CHILDREN ? (
          <Link
            href="/parent/link-child"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-[#534AB7] hover:bg-[#EEEDFE] dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950 transition-colors"
          >
            + Link another child
          </Link>
        ) : (
          <span
            className="inline-flex min-h-[44px] cursor-not-allowed items-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-400 dark:border-gray-700 dark:text-gray-600"
            title="You can link up to 3 children. Remove a child to add another."
            aria-disabled="true"
          >
            + Link another child
          </span>
        )}
      </div>

      {/* ── Active child card ─────────────────────────────────────────────── */}
      <section
        className="rounded-xl border border-gray-200 bg-white px-5 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        aria-label={`${child.name} progress`}
      >
        {/* ── Header row ───────────────────────────────────────────────── */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              {child.name}
            </h2>
            {(child.grade || child.board) && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {[child.grade, child.board].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="mt-1 text-2xs text-gray-400 dark:text-gray-500">
              {timezoneLabel(parentTimezone, child.timezone)}
            </p>
          </div>

          <Link
            href={`/parent/progress/${child.studentId}`}
            className="shrink-0 rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-medium text-[#534AB7] hover:bg-[#EEEDFE] dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950"
          >
            View full report
          </Link>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────── */}
        <div className="mb-4 flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Sessions this week</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-50">
              {child.sessionsThisWeek}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Study streak</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-50">
              🔥 {child.streak}
            </p>
          </div>
          {/* ── Exam countdown (F-PAR-010 AC-02) -- shown only when examDate is set and upcoming ── */}
          {examDays !== null && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Days to exam</p>
              <p
                className={[
                  'mt-0.5 text-lg font-bold',
                  examDays <= 14
                    ? 'text-[#E24B4A]'
                    : examDays <= 30
                      ? 'text-[#BA7517]'
                      : 'text-[#1D9E75]',
                ].join(' ')}
              >
                {examDays}d
              </p>
            </div>
          )}
        </div>

        {/* ── Subject readiness ────────────────────────────────────────── */}
        {child.readiness.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Exam readiness by subject
            </p>
            {child.readiness.map((r) => (
              <SubjectReadinessCard
                key={r.subjectId}
                subjectName={r.subjectName}
                score={r.score}
                subjectId={r.subjectId}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Subjects not set up yet.
          </p>
        )}
      </section>
    </main>
  )
}
