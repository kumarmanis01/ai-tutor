/**
 * FILE OBJECTIVE:
 * - Render the admin review queue for flagged bank questions and allow approve or reject actions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/questions/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | default the review page to pending-review questions and surface the latest flag reason details
 */

'use client'
import { useEffect, useState } from 'react'
import {
  extractQuestionFlagNotes,
  extractQuestionFlagReasonLabel,
} from '@/lib/questions/questionFlagging'

const REVIEW_QUEUE_ENDPOINT = '/api/admin/questions'
const LOADING_COPY = 'Loading flagged questions...'
const EMPTY_COPY = 'No flagged questions are waiting for review.'
const APPROVE_COPY = 'Approve'
const REJECT_COPY = 'Reject'

type QuestionRow = {
  id: string
  prompt: string
  subject: string | null
  topic: { name: string } | null
  sessionFlags: {
    id: string
    reason: string
    details: string | null
    createdAt: string
  }[]
  updatedAt: string
  status: string
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetch(REVIEW_QUEUE_ENDPOINT)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setQuestions(d.questions ?? []))
      .catch(() => {
        setError('Could not load the review queue.')
        setQuestions([])
      })
      .finally(() => setLoading(false))
  }, [])

  async function updateStatus(id: string, status: 'ACTIVE' | 'REJECTED') {
    setActing(id)
    try {
      const res = await fetch(`/api/admin/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id))
        setToast(`Question ${status === 'ACTIVE' ? 'approved' : 'rejected'}: ${id.slice(0, 8)}...`)
        setTimeout(() => setToast(null), 3000)
      } else {
        setError('Could not update the question review status.')
      }
    } finally {
      setActing(null)
    }
  }

  if (loading) return <p className="p-6 text-gray-500">{LOADING_COPY}</p>
  if (error) return <p className="p-6 text-red-600">Error: {error}</p>

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow z-50 text-sm">
          {toast}
        </div>
      )}
      <h1 className="text-2xl font-bold mb-6">Flagged Question Review Queue</h1>
      {!questions.length ? (
        <p className="text-green-600">{EMPTY_COPY}</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b-2 border-gray-200 text-gray-500 text-xs uppercase">
              <th className="pb-2 pr-4 font-medium">Concept</th>
              <th className="pb-2 pr-4 font-medium">Question</th>
              <th className="pb-2 pr-4 font-medium">Latest flag</th>
              <th className="pb-2 pr-4 font-medium">Flags</th>
              <th className="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => {
              const latestFlag = q.sessionFlags[0]
              const latestReason = latestFlag
                ? extractQuestionFlagReasonLabel(latestFlag.details, latestFlag.reason)
                : 'No reason captured'
              const latestNotes = latestFlag ? extractQuestionFlagNotes(latestFlag.details) : null

              return (
                <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-600">{q.topic?.name ?? q.subject ?? '--'}</td>
                  <td className="py-2 pr-4 text-gray-900 max-w-sm">
                    <span title={q.prompt}>
                      {q.prompt.slice(0, 80)}
                      {q.prompt.length > 80 ? '...' : ''}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-700 max-w-xs">
                    <div className="space-y-1">
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {latestReason}
                      </span>
                      {latestNotes ? <p className="text-xs text-gray-500">{latestNotes}</p> : null}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-center">
                    <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      {q.sessionFlags?.length ?? 0}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={acting === q.id}
                        onClick={() => updateStatus(q.id, 'ACTIVE')}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
                      >
                        {APPROVE_COPY}
                      </button>
                      <button
                        type="button"
                        disabled={acting === q.id}
                        onClick={() => updateStatus(q.id, 'REJECTED')}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-40"
                      >
                        {REJECT_COPY}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
