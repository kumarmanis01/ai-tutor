/**
 * FILE OBJECTIVE:
 * - Explore Mode home page (S0.3). Shown to under-18 students after registration while
 *   awaiting parent consent. Polls consent status and shows 3 sample topic cards.
 *   Reads explore_token and grade/board from URL search params.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/explore/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 */

'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useConsentStatus } from '@/hooks/useConsentStatus'
import ExploreBanner from '@/components/student/explore/ExploreBanner'
import ApprovalStatusBar from '@/components/student/explore/ApprovalStatusBar'

interface TopicPreview {
  id: string
  name: string
  sampleNote: string | null
}

export default function ExploreModeClient() {
  const params = useSearchParams()
  const rawToken = params.get('token') ?? ''
  // Strip the "explore:" prefix the backend adds
  const consentToken = rawToken.startsWith('explore:') ? rawToken.slice(8) : rawToken
  // eslint-disable-next-line ai-guards/no-string-filters -- grade/board are user-entered URL params from registration, not DB string filters
  const grade = params.get('grade') ?? ''
  const board = params.get('board') ?? ''

  const consent = useConsentStatus(consentToken || null)
  const [topics, setTopics] = useState<TopicPreview[]>([])
  const [topicsLoading, setTopicsLoading] = useState(false)

  useEffect(() => {
    if (!grade || !board) return
    setTopicsLoading(true)
    // eslint-disable-next-line ai-guards/no-string-filters -- explore-content uses user-facing grade/board inputs, not DB-level string filters
    fetch(`/api/v1/students/explore-content?grade=${encodeURIComponent(grade)}&board=${encodeURIComponent(board)}`)
      .then((r) => r.json())
      .then((d) => setTopics(Array.isArray(d.topics) ? d.topics : []))
      .catch(() => setTopics([]))
      .finally(() => setTopicsLoading(false))
  }, [grade, board])

  // Handle approved → redirect to full learning map
  useEffect(() => {
    if (consent.status === 'APPROVED') {
      // Give user 1.5s to see the celebration message then redirect
      const t = setTimeout(() => { window.location.href = '/dashboard' }, 1500)
      return () => clearTimeout(t)
    }
  }, [consent.status])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-10">
      <ExploreBanner sentTo={consent.sentTo} />

      {/* Approval celebration */}
      {consent.status === 'APPROVED' && (
        <div className="mx-4 mt-4 p-6 rounded-2xl bg-[#EAF3DE] dark:bg-green-900 text-center">
          <p className="text-2xl font-bold text-[#1D9E75]">Mom Approved! 🎉</p>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1">Get ready for unlimited learning!</p>
        </div>
      )}

      {/* Denied */}
      {consent.status === 'DENIED' && (
        <div className="mx-4 mt-4 p-6 rounded-2xl bg-[#FCEBEB] dark:bg-red-900 text-center">
          <p className="text-xl font-bold text-[#E24B4A]">Access Not Approved</p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            Your parent has declined access. Talk to them and try again.
          </p>
          <a href="/register" className="mt-4 inline-block min-h-[44px] px-6 py-2 rounded-xl bg-[#E24B4A] text-white font-semibold text-sm">
            Send New Request
          </a>
        </div>
      )}

      {/* Expired */}
      {consent.status === 'EXPIRED' && (
        <div className="mx-4 mt-4 p-6 rounded-2xl bg-[#FAEEDA] dark:bg-amber-900 text-center">
          <p className="text-xl font-bold text-[#BA7517]">Approval Request Expired</p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">Your approval request has expired. Send a new one?</p>
          <a href="/register" className="mt-4 inline-block min-h-[44px] px-6 py-2 rounded-xl bg-[#BA7517] text-white font-semibold text-sm">
            Send New Request
          </a>
        </div>
      )}

      {/* Status bar (pending state) */}
      {consent.status === 'PENDING' && consentToken && (
        <ApprovalStatusBar
          status={consent.status}
          expiresAt={consent.expiresAt}
          sentTo={consent.sentTo}
          consentToken={consentToken}
        />
      )}

      {/* Sample lessons */}
      <div className="px-4 mt-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          3 Free Sample Lessons
        </h2>
        {topicsLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-gray-200 dark:bg-slate-700 animate-pulse" />
            ))}
          </div>
        ) : topics.length > 0 ? (
          <div className="flex flex-col gap-3">
            {topics.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border-2 border-[#534AB7]/30 bg-[#EEEDFE] dark:bg-[#534AB7]/10 p-4 ring-2 ring-[#534AB7]/20 animate-pulse-slow"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-[#534AB7]">{t.name}</span>
                  <span className="text-xs bg-[#534AB7] text-white px-2 py-0.5 rounded-full">Free Preview</span>
                </div>
                {t.sampleNote && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t.sampleNote}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {grade && board ? "No sample content available for your grade yet." :
              // eslint-disable-next-line ai-guards/no-string-filters -- help text for user, not a DB filter string
              "Add ?grade=&board= to the URL to load sample lessons."}
          </p>
        )}
      </div>
    </div>
  )
}
