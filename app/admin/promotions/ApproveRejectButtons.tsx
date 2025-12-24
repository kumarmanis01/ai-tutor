"use client"
import React, { useState } from 'react'

export default function ApproveRejectButtons({ candidate }: any) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = candidate.status !== 'PENDING'

  async function doAction(action: 'approve' | 'reject') {
    setError(null)
    const ok = window.confirm(action === 'approve' ? 'Approve this candidate?' : 'Reject this candidate?')
    if (!ok) return
    setLoading(true)
    try {
      const url = `/api/admin/promotions/${candidate.id}/${action}`
      const body = action === 'reject' ? { notes: { reason: 'rejected via UI' } } : undefined
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      const jb = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(jb?.error || `Status ${res.status}`)
      // refresh page to reflect status change
      window.location.reload()
    } catch (err: any) {
      setError(String(err?.message ?? err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={() => doAction('approve')} disabled={disabled || loading} className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50 mr-2">{loading ? 'Working…' : 'Approve'}</button>
      <button onClick={() => doAction('reject')} disabled={disabled || loading} className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50">{loading ? 'Working…' : 'Reject'}</button>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  )
}
