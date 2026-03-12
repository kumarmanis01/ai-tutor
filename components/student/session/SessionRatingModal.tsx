'use client'

import React, { useMemo, useState } from 'react'
import { useSubmitSessionRating } from '@/hooks/useSubmitSessionRating'

export default function SessionRatingModal(props: { sessionId: string; onClose: () => void }) {
  const { sessionId, onClose } = props
  const [rating, setRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')

  const { submit, submitting, error } = useSubmitSessionRating(sessionId)

  const activeRating = hoverRating ?? rating ?? 0
  const canSubmit = rating != null && rating >= 1 && rating <= 5 && !submitting

  const remaining = useMemo(() => 280 - feedback.length, [feedback.length])

  async function handleSubmit() {
    if (!canSubmit || rating == null) return
    const ok = await submit({
      rating,
      feedback: feedback.trim().length > 0 ? feedback.trim() : undefined,
    })
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close rating modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <div className="text-lg font-semibold text-gray-900">How was this session?</div>

        <div className="mt-4 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= activeRating
            return (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                onFocus={() => setHoverRating(star)}
                onBlur={() => setHoverRating(null)}
                onClick={() => setRating(star)}
                className="h-10 w-10"
                aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              >
                <svg
                  className={filled ? 'h-10 w-10 text-yellow-400' : 'h-10 w-10 text-gray-300'}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.18 3.63a1 1 0 00.95.69h3.813c.969 0 1.371 1.24.588 1.81l-3.083 2.24a1 1 0 00-.364 1.118l1.18 3.63c.3.922-.755 1.688-1.54 1.118L10 14.347l-3.575 2.836c-.784.57-1.838-.196-1.539-1.118l1.18-3.63a1 1 0 00-.364-1.118L2.62 9.057c-.783-.57-.38-1.81.588-1.81h3.813a1 1 0 00.95-.69l1.078-3.63z" />
                </svg>
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600">Optional feedback</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value.slice(0, 280))}
            placeholder="What could be better? (optional)"
            maxLength={280}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="mt-1 text-right text-[11px] text-gray-500">{remaining} left</div>
        </div>

        {error && <div className="mt-3 text-sm text-amber-700">{error}</div>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

