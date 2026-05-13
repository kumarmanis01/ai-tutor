/**
 * FILE OBJECTIVE:
 * - Render the admin questions review queue table with a detail modal showing full question content and all student flags.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/questions/QuestionsReviewTable.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | created to provide rich question review UI with student flags and details modal
 */

'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  extractQuestionFlagNotes,
  extractQuestionFlagReasonLabel,
} from '@/lib/questions/questionFlagging'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuestionFlag {
  id: string
  reason: string
  details: string | null
  createdAt: string
  student: {
    id: string
    name: string | null
    email: string | null
  }
}

export interface QuestionData {
  id: string
  prompt: string
  subject: string | null
  topic: { name: string } | null
  options: unknown
  answer: string | null
  sessionFlags: QuestionFlag[]
  updatedAt: string
  status: string
}

// ---------------------------------------------------------------------------
// Detail Modal
// ---------------------------------------------------------------------------

type DetailState =
  | { phase: 'idle' }
  | { phase: 'loading'; id: string }
  | { phase: 'loaded'; data: QuestionData }
  | { phase: 'error'; message: string }

function QuestionDetailModal({
  state,
  onClose,
  onApprove,
  onReject,
  isBusy,
}: {
  state: DetailState
  onClose: () => void
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
  isBusy: boolean
}) {
  const data = state.phase === 'loaded' ? state.data : null

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (state.phase === 'idle') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">
            Question Review
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {state.phase === 'loading' && (
            <p className="text-[12px] text-gray-500 py-8 text-center">Loading question...</p>
          )}
          {state.phase === 'error' && (
            <p className="text-[12px] text-[#E24B4A] py-8 text-center">
              {state.message} -- please try again.
            </p>
          )}

          {data && (
            <>
              {/* Metadata */}
              <div>
                <p className="text-[10px] text-gray-400">
                  {data.topic?.name ?? data.subject ?? 'Unknown'}
                </p>
              </div>

              {/* Question prompt */}
              <div>
                <p className="text-[11px] font-semibold text-gray-600 mb-2">Question</p>
                <p className="text-[13px] text-gray-800 dark:text-gray-200 leading-relaxed">
                  {data.prompt}
                </p>
              </div>

              {/* Options (if multiple choice) */}
              {data.options && Array.isArray(data.options) && data.options.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-600 mb-2">Options</p>
                  <ul className="space-y-1.5">
                    {(data.options as string[]).map((opt, i) => {
                      const isCorrect = data.answer && data.answer === String.fromCharCode(65 + i)
                      return (
                        <li
                          key={i}
                          className={`text-[11px] p-2 rounded border ${
                            isCorrect
                              ? 'border-[#1D9E75] bg-[#EAF3DE] text-[#27500A]'
                              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span className="font-medium">{String.fromCharCode(65 + i)}.</span> {opt}
                          {isCorrect && <span className="ml-2 text-[9px] font-semibold">✓ CORRECT</span>}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* Answer key */}
              {data.answer && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                  <p className="text-[11px] font-semibold text-gray-600 mb-1">Correct Answer</p>
                  <p className="text-[13px] text-[#1D9E75] font-bold">{data.answer}</p>
                </div>
              )}

              {/* Student flags */}
              {data.sessionFlags && data.sessionFlags.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                  <p className="text-[11px] font-semibold text-gray-600 mb-3">
                    Student Flags ({data.sessionFlags.length})
                  </p>
                  <div className="space-y-3">
                    {data.sessionFlags.map((flag) => {
                      const reason = extractQuestionFlagReasonLabel(flag.details, flag.reason)
                      const notes = extractQuestionFlagNotes(flag.details)
                      const studentName = flag.student?.name || flag.student?.email || 'Anonymous'

                      return (
                        <div
                          key={flag.id}
                          className="border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 space-y-2"
                        >
                          {/* Header: student + timestamp */}
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                              {studentName}
                            </p>
                            <p className="text-[9px] text-gray-500 whitespace-nowrap">
                              {new Date(flag.createdAt).toLocaleString()}
                            </p>
                          </div>

                          {/* Flag reason badge */}
                          <div>
                            <span className="inline-flex rounded-full bg-amber-200 dark:bg-amber-700 px-2.5 py-0.5 text-[9px] font-semibold text-amber-900 dark:text-amber-100">
                              {reason}
                            </span>
                          </div>

                          {/* Student's comment - highlighted */}
                          {notes && (
                            <div className="border-t border-amber-200 dark:border-amber-800 pt-2 mt-2">
                              <p className="text-[9px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                Student comment:
                              </p>
                              <p className="text-[10px] text-gray-700 dark:text-gray-300 italic border-l-2 border-amber-400 pl-2 py-1">
                                &quot;{notes}&quot;
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer - Actions */}
        {data && (
          <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center gap-2 justify-end bg-gray-50/50 dark:bg-gray-800/50">
            <button
              onClick={onClose}
              className="text-[10px] px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onReject(data.id)}
              disabled={isBusy}
              className="text-[10px] px-3 py-1.5 rounded border border-[#f9d7d7] bg-[#FCEBEB] text-[#791F1F] hover:bg-[#f9d7d7] disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => onApprove(data.id)}
              disabled={isBusy}
              className="text-[10px] px-3 py-1.5 rounded border border-[#c8e6c9] bg-[#EAF3DE] text-[#27500A] hover:bg-[#d9edd9] disabled:opacity-50 transition-colors"
            >
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single row
// ---------------------------------------------------------------------------

function QuestionRow({
  question,
  onRefresh,
  onReview,
}: {
  question: Omit<QuestionData, 'options' | 'answer'>
  onRefresh: () => void
  onReview: (id: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function updateStatus(status: 'ACTIVE' | 'REJECTED') {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/admin/questions/${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Request failed')
      }
      onRefresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  const latestFlag = question.sessionFlags?.[0]
  const latestReason = latestFlag
    ? extractQuestionFlagReasonLabel(latestFlag.details, latestFlag.reason)
    : 'No reason'
  const latestNotes = latestFlag ? extractQuestionFlagNotes(latestFlag.details) : null

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <td className="px-3 py-2.5">
        <p className="text-[11px] text-gray-700 dark:text-gray-300 max-w-[160px] truncate">
          {question.topic?.name ?? question.subject ?? '--'}
        </p>
      </td>
      <td className="px-3 py-2.5 max-w-[280px]">
        <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate" title={question.prompt}>
          {question.prompt}
        </p>
      </td>
      <td className="px-3 py-2.5">
        <div className="space-y-0.5 max-w-xs">
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-medium text-amber-800">
            {latestReason}
          </span>
          {latestNotes && (
            <p className="text-[9px] text-gray-500 italic truncate">{latestNotes}</p>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-medium">
          {question.sessionFlags?.length ?? 0}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {err && <span className="text-[9px] text-[#E24B4A]">{err}</span>}
          <button
            onClick={() => onReview(question.id)}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[28px] transition-colors"
          >
            Review
          </button>
          <button
            onClick={() => updateStatus('ACTIVE')}
            disabled={busy}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-[#c8e6c9] bg-[#EAF3DE] text-[#27500A] hover:bg-[#d9edd9] disabled:opacity-50 min-h-[28px] transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => updateStatus('REJECTED')}
            disabled={busy}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-[#f9d7d7] bg-[#FCEBEB] text-[#791F1F] hover:bg-[#f9d7d7] disabled:opacity-50 min-h-[28px] transition-colors"
          >
            Reject
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Table component
// ---------------------------------------------------------------------------

export function QuestionsReviewTable({ questions: initialQuestions }: { questions: QuestionData[] }) {
  const router = useRouter()
  const [questions, setQuestions] = useState(initialQuestions)
  const [detailState, setDetailState] = useState<DetailState>({ phase: 'idle' })
  const [detailBusy, setDetailBusy] = useState(false)

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  const openReview = useCallback(async (id: string) => {
    setDetailState({ phase: 'loading', id })
    try {
      const r = await fetch(`/api/admin/questions/${id}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Failed to load question')
      setDetailState({ phase: 'loaded', data })
    } catch (e) {
      setDetailState({
        phase: 'error',
        message: e instanceof Error ? e.message : 'Error loading question',
      })
    }
  }, [])

  const closeReview = useCallback(() => {
    setDetailState({ phase: 'idle' })
  }, [])

  const handleApprove = useCallback(
    async (id: string) => {
      setDetailBusy(true)
      try {
        const res = await fetch(`/api/admin/questions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ACTIVE' }),
        })
        if (!res.ok) throw new Error('Failed to approve')
        setQuestions((prev) => prev.filter((q) => q.id !== id))
        closeReview()
        refresh()
      } finally {
        setDetailBusy(false)
      }
    },
    [closeReview, refresh],
  )

  const handleReject = useCallback(
    async (id: string) => {
      setDetailBusy(true)
      try {
        const res = await fetch(`/api/admin/questions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'REJECTED' }),
        })
        if (!res.ok) throw new Error('Failed to reject')
        setQuestions((prev) => prev.filter((q) => q.id !== id))
        closeReview()
        refresh()
      } finally {
        setDetailBusy(false)
      }
    },
    [closeReview, refresh],
  )

  return (
    <>
      <QuestionDetailModal
        state={detailState}
        onClose={closeReview}
        onApprove={handleApprove}
        onReject={handleReject}
        isBusy={detailBusy}
      />

      <div className="space-y-3">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b-2 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase">
              <th className="px-3 py-2.5 font-medium">Concept</th>
              <th className="px-3 py-2.5 font-medium">Question</th>
              <th className="px-3 py-2.5 font-medium">Latest flag</th>
              <th className="px-3 py-2.5 font-medium text-center">Flags</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <QuestionRow
                key={q.id}
                question={q}
                onRefresh={refresh}
                onReview={openReview}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
