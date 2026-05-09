/**
 * FILE OBJECTIVE:
 * - Render dashboard focus area card for the weakest chapter with a direct study CTA.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/dashboard/FocusAreaCard.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T15:45:00Z | copilot | add Focus Area dashboard card with mastery,
 *                          sessions estimate, and CTA to subject progress
 */

import Link from 'next/link'
import type { ReadinessLabel } from '@/lib/student/examReadiness'

export interface FocusAreaCardProps {
  subjectId: string
  subjectName: string
  chapterId: string
  chapterName: string
  masteryPercent: number
  status: ReadinessLabel
  sessionsNeeded: number
  estimatedMinutes: number
  href: string
}

function getStatusTone(status: ReadinessLabel): string {
  if (status === 'critical') return 'bg-[#FCEBEB] text-[#791F1F]'
  if (status === 'needs_work') return 'bg-[#FAEEDA] text-[#633806]'
  if (status === 'on_track') return 'bg-[#EEEDFE] text-[#3C3489]'
  return 'bg-[#EAF3DE] text-[#27500A]'
}

function getStatusLabel(status: ReadinessLabel): string {
  if (status === 'critical') return 'Weak'
  if (status === 'needs_work') return 'Needs work'
  if (status === 'on_track') return 'On track'
  return 'Strong'
}

export function FocusAreaCard({
  subjectName,
  chapterName,
  masteryPercent,
  status,
  sessionsNeeded,
  estimatedMinutes,
  href,
}: FocusAreaCardProps) {
  return (
    <section aria-label="Focus Area" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Focus Area</h2>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusTone(status)}`}>
          {getStatusLabel(status)}
        </span>
      </div>

      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{chapterName}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subjectName}</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-md bg-gray-50 px-2 py-2 text-center dark:bg-gray-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Mastery</p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{masteryPercent}%</p>
        </div>
        <div className="rounded-md bg-gray-50 px-2 py-2 text-center dark:bg-gray-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Sessions</p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{sessionsNeeded}</p>
        </div>
        <div className="rounded-md bg-gray-50 px-2 py-2 text-center dark:bg-gray-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Time</p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">~{estimatedMinutes}m</p>
        </div>
      </div>

      <Link
        href={href}
        className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4840a3]"
      >
        Study Focus Area
      </Link>
    </section>
  )
}

export default FocusAreaCard
