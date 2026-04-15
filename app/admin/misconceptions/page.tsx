"use client"
import React, { useEffect, useState, useMemo } from 'react'
import { AdminTopbar } from '../../../components/admin/AdminTopbar'

type Misconception = {
  id: string
  subjectId: string
  conceptId: string
  name: string
  description: string
  triggerPatterns: string[]
  correction: string
  prevalenceRate: number
}

export default function AdminMisconceptionsPage() {
  const [rows, setRows] = useState<Misconception[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Misconception | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = async (opts?: { q?: string; page?: number; pageSize?: number }) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (opts?.q !== undefined) params.set('q', opts.q)
    if (opts?.page) params.set('page', String(opts.page))
    if (opts?.pageSize) params.set('pageSize', String(opts.pageSize))
    const res = await fetch(`/api/admin/misconceptions?${params.toString()}`)
    if (!res.ok) {
      setError('Failed to load')
      setLoading(false)
      return
    }
    const data = await res.json()
    setRows(data.rows)
    setTotal(data.total)
    setLoading(false)
  }

  useEffect(() => { fetchPage({ q, page, pageSize }) }, [q, page, pageSize])

  async function save(edit: Misconception) {
    // client-side validation
    if (!edit.name || edit.name.trim().length === 0) { setError('Name is required'); return }
    if (!Array.isArray(edit.triggerPatterns) || edit.triggerPatterns.length < 2) { setError('At least 2 trigger patterns required'); return }
    setError(null)

    const res = await fetch(`/api/admin/misconceptions/${edit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edit),
    })
    if (res.ok) {
      const updated = await res.json()
      setRows(r => r.map(x => x.id === updated.id ? updated : x))
      setEditing(null)
    } else {
      const txt = await res.text()
      setError(`Save failed: ${txt}`)
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  return (
    <div>
      <AdminTopbar title="Misconception Library" />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <input placeholder="Search name, description or correction" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} className="flex-1 border rounded px-3 py-2" />
          <select value={pageSize} onChange={e => { setPageSize(parseInt(e.target.value)); setPage(1) }} className="border rounded px-2 py-2">
            {[10,20,50,100].map(s => <option key={s} value={s}>{s}/page</option>)}
          </select>
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-3">
            {rows.map(r => (
              <div key={r.id} className="bg-white dark:bg-gray-900 border rounded p-3 flex justify-between">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-gray-500">{r.subjectId} • {r.conceptId}</div>
                  <div className="mt-2 text-sm">{r.description}</div>
                </div>
                <div className="ml-4 flex items-start gap-2">
                  <button className="px-3 py-1 bg-[#534AB7] text-white rounded" onClick={() => setEditing(r)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">{total} results</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded">Prev</button>
            <div className="px-2">{page} / {totalPages}</div>
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 border rounded">Next</button>
          </div>
        </div>

        {editing && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 border rounded-lg p-6 w-[800px] max-w-full">
              <h2 className="text-lg font-semibold mb-2">Edit Misconception</h2>
              <label className="block text-sm font-medium">Name</label>
              <input className="w-full border rounded px-2 py-1 mb-2" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              <label className="block text-sm font-medium">Description</label>
              <textarea className="w-full border rounded px-2 py-1 mb-2" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              <label className="block text-sm font-medium">Correction</label>
              <textarea className="w-full border rounded px-2 py-1 mb-2" value={editing.correction} onChange={e => setEditing({ ...editing, correction: e.target.value })} />
              <label className="block text-sm font-medium">Trigger Patterns (comma separated)</label>
              <input className="w-full border rounded px-2 py-1 mb-4" value={editing.triggerPatterns.join(', ')} onChange={e => setEditing({ ...editing, triggerPatterns: e.target.value.split(',').map(s => s.trim()) })} />

              <div className="flex justify-end gap-2">
                <button className="px-3 py-1 border rounded" onClick={() => setEditing(null)}>Cancel</button>
                <button className="px-3 py-1 bg-[#534AB7] text-white rounded" onClick={() => save(editing)}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
