"use client"
import React, { useState } from 'react'

export default function TriggerJobButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTrigger() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/regeneration-jobs/${jobId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error || `Status ${res.status}`)
        setLoading(false)
        return
      }
      // Refresh the page to show updated status
      window.location.reload()
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleTrigger}
        disabled={loading}
        className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Triggering…' : 'Trigger Job'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  )
}
