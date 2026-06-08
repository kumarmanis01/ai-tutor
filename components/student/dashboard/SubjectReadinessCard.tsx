/**
 * FILE OBJECTIVE:
 * - Render subject readiness summary with score, readiness status, diagnostics,
 *   predicted score range, and chapter-level mastery breakdown.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/dashboard/SubjectReadinessCard.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-08T00:00:00Z | claude | add isParentView prop to suppress "Start diagnostic" CTA in parent context
 * - 2026-05-09T15:15:00Z | copilot | rewrite readiness card with Tailwind,
 *                          readiness badges, predicted range, retake info,
 *                          and chapter breakdown support
 * - 2026-05-16T12:00:00Z | copilot | show "Start diagnostic" button when diagnostic pending
 */

import type { ReadinessChapter } from '@/lib/student/examReadiness'
import Link from 'next/link'

interface PredictedRange {
  low: number
  high: number
  confidenceLevel: number
}

interface Props {
  subjectName: string
  score: number
  subjectId: string
  diagnosticDone?: boolean
  predictedRange?: PredictedRange | null
  retakeEligibleAt?: string | null
  chapters?: ReadinessChapter[]
  /** When true, suppress student-only actions (e.g. "Start diagnostic" CTA). */
  isParentView?: boolean
}

function normalizePercent(score: number): number {
  if (score <= 1) return Math.round(score * 100)
  return Math.round(score)
}

function getReadinessTone(percent: number): {
  label: string
  badgeClass: string
  textClass: string
} {
  if (percent < 40) {
    return {
      label: 'Critical',
      badgeClass: 'bg-[#FCEBEB] text-[#791F1F] border border-[#F7C1C1]',
      textClass: 'text-[#E24B4A]',
    }
  }
  if (percent < 70) {
    return {
      label: 'Needs work',
      badgeClass: 'bg-[#FAEEDA] text-[#633806] border border-[#F1D8B2]',
      textClass: 'text-[#BA7517]',
    }
  }
  if (percent < 90) {
    return {
      label: 'On track',
      badgeClass: 'bg-[#EEEDFE] text-[#3C3489] border border-[#D5D2F7]',
      textClass: 'text-[#534AB7]',
    }
  }
  return {
    label: 'Exam ready',
    badgeClass: 'bg-[#EAF3DE] text-[#27500A] border border-[#CFE2B8]',
    textClass: 'text-[#1D9E75]',
  }
}

function getChapterStatusClass(status: ReadinessChapter['status']): string {
  if (status === 'critical') return 'bg-[#FCEBEB] text-[#791F1F]'
  if (status === 'needs_work') return 'bg-[#FAEEDA] text-[#633806]'
  if (status === 'on_track') return 'bg-[#EEEDFE] text-[#3C3489]'
  return 'bg-[#EAF3DE] text-[#27500A]'
}

function formatRetakeDate(retakeEligibleAt: string): string {
  const date = new Date(retakeEligibleAt)
  if (Number.isNaN(date.getTime())) return 'Retake available soon'
  return `Retake opens ${date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })}`
}

export function SubjectReadinessCard({
  subjectId,
  subjectName,
  score,
  diagnosticDone,
  predictedRange,
  retakeEligibleAt,
  chapters,
  isParentView,
}: Props) {
  const percent = normalizePercent(score)
  const tone = getReadinessTone(percent)
  const chapterRows = (chapters ?? []).slice(0, 3)

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{subjectName}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Exam readiness</p>
        </div>
        <div className="text-right shrink-0">
          {/*
           * Per CLAUDE.md: never show numeric readiness score next to a
           * knowledge-map result; render tier labels only. Numeric value is
           * kept on aria-label for screen reader users.
           */}
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone.badgeClass}`}
            aria-label={`Readiness: ${tone.label}`}
          >
            {tone.label}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={[
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
            diagnosticDone
              ? 'bg-[#EAF3DE] text-[#27500A]'
              : 'bg-[#FAEEDA] text-[#633806]',
          ].join(' ')}
        >
          {diagnosticDone ? 'Diagnostic complete' : 'Diagnostic pending'}
        </span>

        {!diagnosticDone && !isParentView && (
          <Link
            href={`/diagnostic/${subjectId}`}
            className="ml-2 inline-flex items-center rounded-md bg-[#534AB7] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
            aria-label={`Start diagnostic for ${subjectName}`}
          >
            Start diagnostic
          </Link>
        )}

        {retakeEligibleAt && (
          <span className="inline-flex items-center rounded-full bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-medium text-[#3C3489]">
            {formatRetakeDate(retakeEligibleAt)}
          </span>
        )}
      </div>

      {predictedRange && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          Predicted board score: <span className="font-semibold text-gray-800 dark:text-gray-100">{predictedRange.low}-{predictedRange.high}</span>{' '}
          <span className="text-gray-500 dark:text-gray-400">({predictedRange.confidenceLevel}% CI)</span>
        </p>
      )}

      {chapterRows.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2.5 dark:border-gray-800">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Chapter mastery
          </p>
          <ul className="space-y-1.5">
            {chapterRows.map((chapter) => {
              const chapterPercent = Math.round(chapter.masteryScore * 100)
              return (
                <li key={chapter.chapterId} className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-gray-700 dark:text-gray-200">{chapter.chapterName}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getChapterStatusClass(chapter.status)}`}
                      aria-label={`Chapter mastery: ${chapter.status.replace('_', ' ')}`}
                      data-testid={`chapter-mastery-${chapter.chapterId}`}
                      data-mastery-percent={chapterPercent}
                    >
                      {chapter.status.replace('_', ' ')}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </article>
  )
}

export default SubjectReadinessCard;
