'use client'

/**
 * ConsentGate — DPDP consent overlay (T37)
 *
 * IMPORTANT: This component is gated behind NEXT_PUBLIC_CONSENT_LIVE.
 * It will NOT render until that env var is set to "true".
 *
 * The consent copy below is a LEGAL PLACEHOLDER.
 * DO NOT set NEXT_PUBLIC_CONSENT_LIVE=true until a lawyer has
 * reviewed and approved the final consent language.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Only rendered when NEXT_PUBLIC_CONSENT_LIVE === 'true'
const CONSENT_LIVE = process.env.NEXT_PUBLIC_CONSENT_LIVE === 'true'

export default function ConsentGate() {
  const router = useRouter()
  const [dataProcessing, setDataProcessing] = useState(false)
  const [aiInteraction, setAiInteraction] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Feature-gated — renders nothing until lawyer approves copy
  if (!CONSENT_LIVE) return null

  const bothChecked = dataProcessing && aiInteraction

  async function handleAgree() {
    if (!bothChecked || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/consent/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: ['DATA_PROCESSING', 'AI_INTERACTION'] }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any)?.error ?? 'Failed to save consent')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white px-6 pb-8 pt-6 shadow-2xl dark:bg-gray-900 sm:rounded-2xl">
        {/* Header */}
        <h2
          id="consent-title"
          className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-50"
        >
          Before we continue
        </h2>

        {/* ⚠️  LEGAL PLACEHOLDER — must be replaced before going live */}
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
          Spinzy needs your consent to:
        </p>
        <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>
            Process your academic data (grades, answers, progress) to personalise your learning.
          </li>
          <li>
            Use AI to generate tutoring responses during your sessions.
          </li>
        </ol>
        <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">
          You can withdraw consent at any time from{' '}
          <span className="font-medium">Profile → Privacy Settings</span>.{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            Learn more
          </a>
        </p>

        {/* Checkboxes */}
        <div className="mb-6 space-y-3">
          <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200">
            <input
              type="checkbox"
              checked={dataProcessing}
              onChange={(e) => setDataProcessing(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-indigo-600"
            />
            I consent to Spinzy processing my academic data to personalise my learning
          </label>
          <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200">
            <input
              type="checkbox"
              checked={aiInteraction}
              onChange={(e) => setAiInteraction(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-indigo-600"
            />
            I consent to AI-generated tutoring responses during my sessions
          </label>
        </div>

        {/* Error */}
        {error && (
          <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* CTA */}
        <button
          onClick={handleAgree}
          disabled={!bothChecked || loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white
            transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40
            dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {loading ? 'Saving…' : 'I agree'}
        </button>
      </div>
    </div>
  )
}
