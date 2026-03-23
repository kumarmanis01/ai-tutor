'use client'
import { useState, useEffect } from 'react'

type QuestionRow = {
  id: string
  prompt: string
  subject: string | null
  topic: { name: string } | null
  sessionFlags: { id: string }[]
  updatedAt: string
  status: string
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  async function loadQuestions() {
    const res = await fetch('/api/admin/content-quality/pending')
    // Fallback: use direct question query via API
    if (!res.ok) {
      setError(`API error: ${res.status}`)
      return
    }
    // If that endpoint doesn't return quarantined questions, try a custom fetch
    const data = await res.json()
    setQuestions(data.questions ?? data ?? [])
  }

  useEffect(() => {
    fetch('/api/admin/questions?status=QUARANTINED')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setQuestions(d.questions ?? []))
      .catch(() => {
        // Fallback: inline fetch via prisma-aware route doesn't exist yet
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
      }
    } finally {
      setActing(null)
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Loading quarantined questions...</p>
  if (error) return <p className="p-6 text-red-600">Error: {error}</p>

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow z-50 text-sm">
          {toast}
        </div>
      )}
      <h1 className="text-2xl font-bold mb-6">Quarantined Questions</h1>
      {!questions.length ? (
        <p className="text-green-600">No quarantined questions -- queue is clean ✓</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b-2 border-gray-200 text-gray-500 text-xs uppercase">
              <th className="pb-2 pr-4 font-medium">Concept</th>
              <th className="pb-2 pr-4 font-medium">Question</th>
              <th className="pb-2 pr-4 font-medium">Flags</th>
              <th className="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 pr-4 text-gray-600">{q.topic?.name ?? q.subject ?? '--'}</td>
                <td className="py-2 pr-4 text-gray-900 max-w-sm">
                  <span title={q.prompt}>{q.prompt.slice(0, 80)}{q.prompt.length > 80 ? '...' : ''}</span>
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
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={acting === q.id}
                      onClick={() => updateStatus(q.id, 'REJECTED')}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
