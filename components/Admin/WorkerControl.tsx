"use client"
import React, { useEffect, useState } from 'react'

type WorkerRow = {
  id: string
  type: string
  host?: string | null
  pid?: number | null
  status: string
  startedAt?: string | null
  stoppedAt?: string | null
  lastHeartbeatAt?: string | null
}

export default function WorkerControl() {
  const [type, setType] = useState('content-hydration')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<null | { lifecycleId: string; type: string }>(null)
  const [error, setError] = useState<string | null>(null)
  const [workers, setWorkers] = useState<WorkerRow[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [stoppingIds, setStoppingIds] = useState<string[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmDrain, setConfirmDrain] = useState(true)
  const [confirmLoading, setConfirmLoading] = useState(false)

  async function fetchWorkers() {
    try {
      const res = await fetch('/api/admin/workers')
      if (!res.ok) return
      const data = await res.json()
      setWorkers(Array.isArray(data) ? data.map((r: any) => ({
        id: r.id,
        type: r.type,
        host: r.host ?? null,
        pid: r.pid ?? null,
        status: r.status,
        startedAt: r.startedAt ?? null,
        stoppedAt: r.stoppedAt ?? null,
        lastHeartbeatAt: r.lastHeartbeatAt ?? null,
      })) : [])
    } catch {
      // ignore
    }
  }

  const totalPages = Math.max(1, Math.ceil(workers.length / pageSize))
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [workers.length, pageSize, page, totalPages])

  useEffect(() => { fetchWorkers() }, [])

  async function startWorker() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', type }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || res.statusText)
      }
      const data = await res.json()
      setResult(data)
      // refresh list
      fetchWorkers()
    } catch (err: any) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  function fireToast(message: string, duration = 3000) {
    if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, duration } }))
    }
  }

  async function copyToClipboard(text: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        fireToast('Copied to clipboard')
      }
    } catch {
      fireToast('Unable to copy')
    }
  }

  async function stopWorker(id: string, drain = true) {
    if (!id) return
    setStoppingIds((s) => [...s, id])
    try {
      const res = await fetch('/api/admin/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop', id, drain }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b?.error || res.statusText)
      }
      fireToast('Stop requested')
      fetchWorkers()
    } catch (err: any) {
      fireToast(String(err?.message || 'Stop failed'))
    } finally {
      setStoppingIds((s) => s.filter((x) => x !== id))
    }
  }

  return (
    <div className="p-4 bg-white rounded shadow-sm max-w-3xl">
      <h3 className="text-lg font-medium mb-2">Worker Control</h3>
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Worker Type</label>
        <input value={type} onChange={(e) => setType(e.target.value)} className="border px-2 py-1 w-full" />
      </div>
      <div className="flex items-center gap-2 mb-4">
        <button disabled={loading} onClick={startWorker} className="bg-blue-600 text-white px-3 py-1 rounded">
          {loading ? 'Starting…' : 'Start Worker'}
        </button>
        <button onClick={fetchWorkers} className="px-3 py-1 border rounded">Refresh</button>
      </div>

      {result && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded flex items-start justify-between">
          <div>
            <div className="text-sm">Started: <strong>{result.type}</strong></div>
            <div className="text-sm">Lifecycle ID: <code className="break-all">{result.lifecycleId}</code></div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => copyToClipboard(result.lifecycleId)} className="px-2 py-1 bg-gray-100 border rounded">Copy ID</button>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6">
        <h4 className="text-sm font-semibold mb-2">Recent Workers</h4>
        <div className="space-y-2">
          {workers.length === 0 && <div className="text-sm text-gray-500">No workers found.</div>}
          {workers.slice((page - 1) * pageSize, page * pageSize).map((w) => (
            <div key={w.id} className="p-2 border rounded flex items-center justify-between">
              <div className="text-sm">
                <div className="flex items-center gap-3">
                  <div><strong>{w.type}</strong></div>
                  <div className="text-xs text-gray-600">{w.status}</div>
                </div>
                <div className="text-xs text-gray-500">id: <code className="break-all">{w.id}</code></div>
                <div className="text-xs text-gray-500">host: {w.host ?? '—'} • pid: {w.pid ?? '—'}</div>
                <div className="text-xs text-gray-500">started: {w.startedAt ?? '—'}</div>
                <div className="text-xs text-gray-500">lastHeartbeat: {w.lastHeartbeatAt ?? '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => copyToClipboard(w.id)} className="px-2 py-1 border rounded text-sm">Copy ID</button>
                <button
                  onClick={() => setConfirmId(w.id)}
                  disabled={stoppingIds.includes(w.id)}
                  className="px-2 py-1 bg-red-600 text-white rounded text-sm disabled:opacity-50"
                >
                  {stoppingIds.includes(w.id) ? 'Stopping…' : 'Stop'}
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-gray-600">Page {page} / {totalPages}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-2 py-1 border rounded">Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-2 py-1 border rounded">Next</button>
            </div>
          </div>
        </div>
      </div>
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setConfirmId(null)} />
          <div className="bg-white rounded shadow-lg p-4 z-10 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Stop Worker</h3>
            <p className="text-sm text-gray-700 mb-3">Are you sure you want to stop worker <code className="break-all">{confirmId}</code> ?</p>
            <div className="flex items-center gap-2 mb-3">
              <input id="drain" type="checkbox" checked={confirmDrain} onChange={(e) => setConfirmDrain(e.target.checked)} />
              <label htmlFor="drain" className="text-sm text-gray-600">Drain (allow current job to finish)</label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmId(null)} className="px-3 py-1 border rounded">Cancel</button>
              <button
                onClick={async () => {
                  setConfirmLoading(true)
                  await stopWorker(confirmId, confirmDrain)
                  setConfirmLoading(false)
                  setConfirmId(null)
                }}
                disabled={confirmLoading}
                className="px-3 py-1 bg-red-600 text-white rounded"
              >
                {confirmLoading ? 'Stopping…' : 'Confirm Stop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
