/**
 * FILE OBJECTIVE:
 * - Render secondary dashboard start actions (Today's topic, Browse syllabus,
 *   Surprise me) and route to a valid actionable destination.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/dashboard/SecondaryStartOptions.test.tsx
 *
 * EDIT LOG:
 * - 2026-05-06T00:00:00Z | copilot | wire todaysHref from dashboard card state,
 *                          make Today's topic selected by default, and add
 *                          no-op-safe Surprise me fallback routing
 * - 2026-05-06T00:00:00Z | copilot | on Surprise me API failure, route to today's
 *                          actionable href (or browse fallback) instead of no-op
 * - 2026-05-08T00:00:00Z | copilot | align secondary CTA behavior with F-STU-010 AC-02:
 *                          default Today's topic fallback to browse syllabus and
 *                          rename Browse topics label to Browse syllabus
 * - 2026-05-08T00:00:00Z | copilot | add direct component tests for Browse
 *                          syllabus and Surprise me success/fallback routing
 * - 2026-05-09T14:45:00Z | copilot | fix: on Surprise me 204 or missing action,
 *                          route to /dashboard (home) not resolvedTodaysHref which may be
 *                          /learn/learning-path; never fallback Surprise me to syllabus browser
 * - 2026-05-09T16:05:00Z | copilot | replace hardcoded CTA colors with theme
 *                          token classes (primary/primary-bg/brand-primary) for
 *                          rebrand-safe styling consistency
 * - 2026-05-10T00:00:00Z | staff-engineer | replace single todaysHref prop with
 *                          todaysTopics array to support multi-subject plans;
 *                          show one link per subject when multiple plans exist
 */

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

const FALLBACK_BROWSE_HREF = '/learn/learning-path'

export default function SecondaryStartOptions({
  todaysTopics = [],
}: {
  todaysTopics?: { subject: string; href: string }[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSurprise() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/student/surprise-me')
      if (res.status === 401) {
        toast('Please sign in to use Surprise me')
        setLoading(false)
        return
      }
      if (res.status === 204) {
        toast('No weak topic available right now. Heading home.')
        router.push('/dashboard')
        return
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to get suggestion')
      const action = json?.action
      if (!action || !action.topicId) {
        toast("Couldn't find a weak topic. Heading home.")
        router.push('/dashboard')
        return
      }
      router.push(`/session/pre/${encodeURIComponent(action.topicId)}`)
    } catch (err: any) {
      toast(String(err?.message || 'Could not pick a surprise topic'))
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {todaysTopics.length === 0 ? (
        <Link
          href={FALLBACK_BROWSE_HREF}
          className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-xl border border-gray-200 text-sm font-medium text-gray-400 cursor-default pointer-events-none"
          aria-disabled="true"
          tabIndex={-1}
        >
          Today&apos;s topic
        </Link>
      ) : todaysTopics.length === 1 ? (
        <Link
          href={todaysTopics[0].href}
          className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-xl border border-primary bg-primary-bg text-sm font-semibold text-primary hover:bg-brand-primary/15"
        >
          Today&apos;s topic
        </Link>
      ) : (
        todaysTopics.map((topic) => (
          <Link
            key={topic.subject}
            href={topic.href}
            className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-xl border border-primary bg-primary-bg text-sm font-semibold text-primary hover:bg-brand-primary/15"
          >
            {topic.subject}
          </Link>
        ))
      )}

      <Link
        href={FALLBACK_BROWSE_HREF}
        className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Browse syllabus
      </Link>

      <button
        type="button"
        onClick={handleSurprise}
        disabled={loading}
        className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover disabled:opacity-60"
      >
        {loading ? 'Picking...' : 'Surprise me'}
      </button>
    </div>
  )
}
