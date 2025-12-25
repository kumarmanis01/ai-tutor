"use client"
import React, { useState } from 'react'

export default function TriggerButton({ suggestionId, targetType, targetId }: { suggestionId: string, targetType: string, targetId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleTrigger() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/regeneration-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, targetType, targetId }),
      })
      const body = await res.json()
      setResult(res.ok ? 'Triggered' : `Error: ${body?.error || res.status}`)
    } catch (err: any) {
      setResult(String(err?.message ?? err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleTrigger} disabled={loading} style={{ padding: '8px 12px' }}>
        {loading ? 'Triggering…' : 'Trigger Job'}
      </button>
      {result && <div style={{ marginTop: 8 }}>{result}</div>}
    </div>
  )
}
