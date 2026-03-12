'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRevisionsDueToday, type RevisionDueItem } from '@/hooks/useRevisionsDueToday'
import { useRevisionsUpcoming } from '@/hooks/useRevisionsUpcoming'

function OverdueBadge({ overdueByDays }: { overdueByDays: number }) {
  const days = Math.floor(overdueByDays)
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
        <span aria-hidden>🟡</span> Due today
      </span>
    )
  }
  if (days === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">
        <span aria-hidden>🔴</span> Overdue 1d
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">
      <span aria-hidden>🔴</span> Overdue {days}d
    </span>
  )
}

function RetentionBadge({ retention }: { retention: number }) {
  const pct = Math.round(retention * 100)
  const isRed = retention < 0.5
  const isAmber = retention >= 0.5 && retention <= 0.8
  const isGreen = retention > 0.8
  const classes = isRed
    ? 'text-red-700 bg-red-50'
    : isAmber
      ? 'text-amber-700 bg-amber-50'
      : isGreen
        ? 'text-green-700 bg-green-50'
        : 'text-gray-700 bg-gray-100'
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded ${classes}`}>
      {pct}% retained
    </span>
  )
}

function formatNextReview(daysUntil: number): string {
  if (daysUntil <= 0) return 'Today'
  if (daysUntil === 1) return 'Tomorrow'
  return `In ${daysUntil} days`
}

function RevisionRow({
  item,
  onStart,
}: {
  item: RevisionDueItem
  onStart: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-3 border-b border-gray-100 last:border-b-0 min-w-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.conceptName}</p>
        <p className="text-xs text-gray-500 truncate">{item.subjectName}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 flex-wrap">
        <OverdueBadge overdueByDays={item.overdueByDays} />
        <RetentionBadge retention={item.retention} />
      </div>
      <button
        type="button"
        onClick={onStart}
        className="flex-shrink-0 text-sm font-medium text-primary hover:underline"
      >
        Start →
      </button>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="h-5 bg-gray-200 rounded w-1/3 mb-4 animate-pulse" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 py-3 border-b border-gray-100 last:border-b-0">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-1/4 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RevisionWidget() {
  const router = useRouter()
  const { revisions, totalDue, loading, error, retry } = useRevisionsDueToday()
  const { nextReview, loading: upcomingLoading } = useRevisionsUpcoming()

  if (loading) {
    return (
      <section aria-label="Revisions due today" className="w-full max-w-full">
        <SkeletonCard />
      </section>
    )
  }

  if (error) {
    return (
      <section aria-label="Revisions due today" className="w-full max-w-full">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-700 mb-3">Could not load revisions.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  if (revisions.length === 0) {
    const nextLabel =
      !upcomingLoading && nextReview
        ? formatNextReview(nextReview.daysUntil)
        : null
    return (
      <section aria-label="Revisions due today" className="w-full max-w-full">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900 mb-1">✅ You&apos;re all caught up!</p>
          {nextLabel !== null && (
            <p className="text-xs text-gray-500">
              Next review: {nextLabel}
            </p>
          )}
        </div>
      </section>
    )
  }

  const displayItems = revisions.slice(0, 3)
  const showViewAll = totalDue > 3

  return (
    <section aria-label="Revisions due today" className="w-full max-w-full">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            📚 Review Today ({totalDue} due)
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {displayItems.map((item) => (
            <RevisionRow
              key={item.conceptId}
              item={item}
              onStart={() =>
                router.push(
                  `/student/session/start?conceptId=${encodeURIComponent(item.conceptId)}&mode=revision`,
                )
              }
            />
          ))}
        </div>
        {showViewAll && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Link
              href="/student/revisions"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all {totalDue} →
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

export default RevisionWidget
