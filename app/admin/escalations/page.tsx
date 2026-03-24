'use client'
import { useState, useEffect } from 'react'

type Escalation = {
  id: string
  studentId: string
  conceptId: string | null
  doubtText: string
  aiAttempts: unknown
  createdAt: string
  student: { email: string | null } | null
}

const RESOLUTION_TYPES = ['chunk_updated', 'misconception_added', 'prompt_fix', 'cached_answer']

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState<Record<string, { type: string; note: string }>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/escalations')
      .then((r) => r.json())
      .then((d) => setEscalations(d.escalations ?? []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  async function resolveEscalation(id: string) {
    const state = resolving[id]
    if (!state?.type) return
    setSubmitting(id)
    try {
      const res = await fetch(`/api/admin/escalations/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionType: state.type, resolutionNote: state.note }),
      })
      if (res.ok) {
        setEscalations((prev) => prev.filter((e) => e.id !== id))
        setToast(`Resolved escalation ${id.slice(0, 8)}...`)
        setTimeout(() => setToast(null), 3000)
      }
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Loading escalations...</p>
  if (error) return <p className="p-6 text-red-600">Error: {error}</p>

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow z-50 text-sm">
          {toast}
        </div>
      )}
      <h1 className="text-2xl font-bold mb-6">Doubt Escalations</h1>
      {!escalations.length ? (
        <p className="text-green-600">No open escalations ✓</p>
      ) : (
        <div className="space-y-3">
          {escalations.map((e) => (
            <div key={e.id} className="border border-amber-200 bg-amber-50 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 mb-1">
                    {new Date(e.createdAt).toLocaleDateString()} ·{' '}
                    Student: {(e.student?.email ?? e.studentId).slice(0, 20)} ·{' '}
                    Concept: {e.conceptId?.slice(0, 12) ?? '--'}
                  </div>
                  <p className="text-sm text-gray-900 line-clamp-2">
                    {e.doubtText.slice(0, 120)}{e.doubtText.length > 120 ? '...' : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    AI attempts: {Array.isArray(e.aiAttempts) ? e.aiAttempts.length : '?'}
                  </p>
                </div>
                <div className="flex-shrink-0 flex flex-col gap-2 w-48">
                  <select
                    value={resolving[e.id]?.type ?? ''}
                    onChange={(ev) =>
                      setResolving((prev) => ({
                        ...prev,
                        [e.id]: { type: ev.target.value, note: prev[e.id]?.note ?? '' },
                      }))
                    }
                    className="text-xs border border-gray-300 rounded px-1 py-1 bg-white"
                  >
                    <option value="">-- resolution type --</option>
                    {RESOLUTION_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Resolution note"
                    value={resolving[e.id]?.note ?? ''}
                    onChange={(ev) =>
                      setResolving((prev) => ({
                        ...prev,
                        [e.id]: { type: prev[e.id]?.type ?? '', note: ev.target.value },
                      }))
                    }
                    className="text-xs border border-gray-300 rounded px-1 py-1"
                  />
                  <button
                    type="button"
                    disabled={!resolving[e.id]?.type || submitting === e.id}
                    onClick={() => resolveEscalation(e.id)}
                    className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40"
                  >
                    {submitting === e.id ? 'Resolving...' : 'Mark resolved'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
