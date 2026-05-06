/**
 * FILE OBJECTIVE:
 * - Render secondary dashboard start actions (Today's topic, Browse topics,
 *   Surprise me) and route to a valid actionable destination.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/dashboard/page.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-06T00:00:00Z | copilot | wire todaysHref from dashboard card state,
 *                          make Today's topic selected by default, and add
 *                          no-op-safe Surprise me fallback routing
 * - 2026-05-06T00:00:00Z | copilot | on Surprise me API failure, route to today's
 *                          actionable href (or browse fallback) instead of no-op
 */

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

const FALLBACK_BROWSE_HREF = '/learn/learning-path'
const DASHBOARD_HREF = '/dashboard'

export default function SecondaryStartOptions({
  todaysConceptId,
  todaysHref,
}: {
  todaysConceptId?: string | null
  todaysHref?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const resolvedTodaysHref =
    todaysHref ?? (todaysConceptId ? `/session/pre/${encodeURIComponent(todaysConceptId)}` : DASHBOARD_HREF)

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
        toast('No surprise suggestion available right now. Opening today\'s topic.')
        router.push(resolvedTodaysHref !== DASHBOARD_HREF ? resolvedTodaysHref : FALLBACK_BROWSE_HREF)
        return
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to get suggestion')
      const action = json?.action
      if (!action || !action.topicId) {
        toast('No surprise suggestion returned. Opening today\'s topic.')
        router.push(resolvedTodaysHref !== DASHBOARD_HREF ? resolvedTodaysHref : FALLBACK_BROWSE_HREF)
        return
      }
      // Navigate to the pre-session screen for the suggested topic
      router.push(`/session/pre/${encodeURIComponent(action.topicId)}`)
    } catch (err: any) {
      toast(String(err?.message || 'Could not pick a surprise topic'))
      router.push(resolvedTodaysHref !== DASHBOARD_HREF ? resolvedTodaysHref : FALLBACK_BROWSE_HREF)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <Link
        href={resolvedTodaysHref}
        className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-xl border border-[#534AB7] bg-[#EEEDFE] text-sm font-semibold text-[#534AB7] hover:bg-[#e5e3fc]"
      >
        Today's topic
      </Link>

      <Link
        href={FALLBACK_BROWSE_HREF}
        className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Browse topics
      </Link>

      <button
        type="button"
        onClick={handleSurprise}
        disabled={loading}
        className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-xl bg-[#534AB7] text-white text-sm font-medium hover:bg-[#4840a3] disabled:opacity-60"
      >
        {loading ? 'Picking...' : 'Surprise me'}
      </button>
    </div>
  )
}
