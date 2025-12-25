"use client"
import React, { useState } from 'react'

const REASON_CODES = [
  'TRANSIENT_FAILURE',
  'BAD_INPUT',
  'IMPROVED_PROMPT',
  'INFRA_ERROR',
  'OTHER',
]

export default function CreateRetryIntent({ job }: any) {
  const [open, setOpen] = useState(false)
  const [reasonCode, setReasonCode] = useState(REASON_CODES[0])
  const [reasonText, setReasonText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = job?.status !== 'FAILED'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const body = {
        sourceJobId: job.id,
        sourceOutputRef: job.outputRef ?? null,
        reasonCode,
        reasonText,
      }
      const res = await fetch('/api/admin/retry-intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b?.error || `Status ${res.status}`)
      }
      // refresh to show new intent
      window.location.reload()
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        Create Retry Intent
      </button>

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-96">
            <h3 className="text-lg font-semibold mb-2">Create Retry Intent</h3>
            <form onSubmit={handleSubmit}>
              <label className="block mb-2">Reason</label>
              <select className="w-full mb-3 p-2 border" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                {REASON_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="block mb-2">Explanation</label>
              <textarea required className="w-full p-2 border mb-3" rows={4} value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-1">Cancel</button>
                <button type="submit" disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50">{loading ? 'Creating…' : 'Create'}</button>
              </div>
              {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
