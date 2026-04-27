'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RestartWorkerButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function restart() {
    if (!window.confirm('Restart the task worker process via pm2? Active jobs will be interrupted.')) return
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      const r = await fetch('/api/admin/system/restart-worker', { method: 'POST' })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error ?? 'Restart failed')
      setMsg(body.message ?? 'Worker restarted -- waiting for heartbeat...')
      // Refresh after a brief delay so the new worker has time to register
      setTimeout(() => router.refresh(), 5_000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 mt-2">
      <button
        onClick={restart}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-[#f9d7d7] bg-[#FCEBEB] text-[#791F1F] hover:bg-[#f9d7d7] disabled:opacity-50 min-h-[32px] transition-colors w-fit"
      >
        {busy ? 'Restarting...' : 'Restart worker now'}
      </button>
      {msg && <span className="text-[10px] text-[#1D9E75]">{msg}</span>}
      {err && <span className="text-[10px] text-[#E24B4A]">{err}</span>}
    </div>
  )
}
