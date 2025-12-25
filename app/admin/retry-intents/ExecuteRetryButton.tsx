"use client"
import React, { useState } from 'react'

export default function ExecuteRetryButton({ intentId }: { intentId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExecute() {
    setError(null)
    const ok = window.confirm('This will create a new regeneration job. Continue?')
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/retry-intents/${intentId}/execute`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.error || `Status ${res.status}`)
      }
      const jobId = body?.job?.id
      if (jobId) {
        window.location.href = `/admin/regeneration-jobs/${jobId}`
        return
      }
      // fallback: reload
      window.location.reload()
    } catch (err: any) {
      setError(String(err?.message ?? err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleExecute} disabled={loading} className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50">
        {loading ? 'Executing…' : 'Execute Retry'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  )
}
