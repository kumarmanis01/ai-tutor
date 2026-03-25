'use client'

import Link from 'next/link'

export interface SubjectReadinessCardProps {
  subjectName: string
  score: number
  subjectId: string
  loading?: boolean
  error?: boolean
}

function ReadinessCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
      <div className="flex items-center gap-4">
        {/* Ring skeleton */}
        <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}

type ColorConfig = { border: string; text: string; bar: string; label: string }

function getColorConfig(score: number): ColorConfig {
  if (score < 40) {
    return {
      border: 'border-[#E24B4A]',
      text: 'text-[#E24B4A]',
      bar: 'bg-[#E24B4A]',
      label: 'Critical',
    }
  }
  if (score <= 70) {
    return {
      border: 'border-[#BA7517]',
      text: 'text-[#BA7517]',
      bar: 'bg-[#BA7517]',
      label: 'Needs work',
    }
  }
  return {
    border: 'border-[#1D9E75]',
    text: 'text-[#1D9E75]',
    bar: 'bg-[#1D9E75]',
    label: 'On track',
  }
}

export function SubjectReadinessCard({
  subjectName,
  score,
  subjectId,
  loading = false,
  error = false,
}: SubjectReadinessCardProps) {
  if (loading) return <ReadinessCardSkeleton />

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Couldn&apos;t load readiness</p>
      </div>
    )
  }

  // Empty state: score 0 = no data
  if (score === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{subjectName}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Take diagnostic to see readiness
        </p>
        <Link
          href={`/diagnostic/${subjectId}`}
          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#534AB7] text-white text-xs font-medium hover:bg-[#3C3489] transition-colors"
        >
          Start Diagnostic →
        </Link>
      </div>
    )
  }

  const { border, text, bar, label } = getColorConfig(score)

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4">
      <div className="flex items-center gap-4">
        {/* Score ring */}
        <div
          className={`flex-shrink-0 w-16 h-16 rounded-full border-4 ${border} flex flex-col items-center justify-center`}
          aria-label={`${subjectName} readiness: ${score}%`}
        >
          <span className={`text-base font-bold leading-none ${text}`}>{score}</span>
          <span className={`text-[9px] font-medium leading-tight ${text}`}>/ 100</span>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {subjectName}
            </p>
            <span className={`flex-shrink-0 text-xs font-medium ${text}`}>{label}</span>
          </div>

          {/* Progress bar */}
          <div
            className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full ${bar} transition-all duration-300`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubjectReadinessCard
