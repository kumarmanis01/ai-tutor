'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { timeSince } from '@/lib/admin/formatters'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichedJob {
  id: string
  jobType: string
  subjectName: string
  grade: number
  boardSlug: string
  status: string
  lastError: string | null
  lockedAt: string | null
  chaptersExpected: number
  chaptersCompleted: number
  notesExpected: number
  notesCompleted: number
  questionsExpected: number
  questionsCompleted: number
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_SORT: Record<string, number> = {
  running: 0,
  failed: 1,
  paused: 2,
  pending: 3,
  completed: 4,
  cancelled: 5,
}

function sortJobs(jobs: EnrichedJob[]): EnrichedJob[] {
  return [...jobs].sort((a, b) => {
    const oa = STATUS_SORT[a.status] ?? 6
    const ob = STATUS_SORT[b.status] ?? 6
    if (oa !== ob) return oa - ob
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

function jobProgress(job: EnrichedJob): number {
  const expected = job.chaptersExpected + job.notesExpected + job.questionsExpected
  const done = job.chaptersCompleted + job.notesCompleted + job.questionsCompleted
  if (expected === 0) return job.status === 'completed' ? 100 : 0
  return Math.round((done / expected) * 100)
}

const ACTIVE_STATUSES = new Set(['running', 'pending', 'failed', 'paused'])

const STATUS_CFG: Record<string, { bg: string; text: string }> = {
  running:   { bg: 'bg-[#E6F1FB]', text: 'text-[#0C447C]' },
  pending:   { bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  completed: { bg: 'bg-[#EAF3DE]', text: 'text-[#27500A]' },
  failed:    { bg: 'bg-[#FCEBEB]', text: 'text-[#791F1F]' },
  paused:    { bg: 'bg-gray-100',  text: 'text-gray-600' },
  cancelled: { bg: 'bg-gray-100',  text: 'text-gray-500' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { bg: 'bg-gray-100', text: 'text-gray-500' }
  return (
    <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

function JobActions({ job, onRefresh }: { job: EnrichedJob; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function call(url: string) {
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch(url, { method: 'POST' })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Failed')
      onRefresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  const { status, id } = job

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {err && <span className="text-[9px] text-[#E24B4A] mr-1 w-full">{err}</span>}

      {status === 'running' && (
        <>
          <Btn onClick={() => call(`/api/admin/jobs/${id}/pause`)} disabled={busy} v="warn">Pause</Btn>
          <Btn onClick={() => call(`/api/admin/jobs/${id}/cancel`)} disabled={busy} v="danger">Cancel</Btn>
        </>
      )}
      {(status === 'pending') && (
        <Btn onClick={() => call(`/api/admin/jobs/${id}/cancel`)} disabled={busy} v="danger">Cancel</Btn>
      )}
      {status === 'paused' && (
        <>
          <Btn onClick={() => call(`/api/admin/jobs/${id}/resume`)} disabled={busy} v="primary">Resume</Btn>
          <Btn onClick={() => call(`/api/admin/jobs/${id}/cancel`)} disabled={busy} v="danger">Cancel</Btn>
        </>
      )}
      {status === 'failed' && (
        <Btn
          onClick={async () => {
            setBusy(true)
            setErr(null)
            try {
              const r = await fetch('/api/admin/content/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: id }),
              })
              if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Failed')
              onRefresh()
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Error')
            } finally {
              setBusy(false)
            }
          }}
          disabled={busy}
          v="success"
        >
          Retry
        </Btn>
      )}
      <Link
        href={`/admin/jobs/${id}`}
        className="inline-flex text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 min-h-[28px] items-center"
      >
        Details
      </Link>
    </div>
  )
}

function Btn({
  children, onClick, disabled, v,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled: boolean
  v: 'primary' | 'danger' | 'success' | 'warn'
}) {
  const cls = {
    primary: 'border-[#534AB7] bg-[#EEEDFE] text-[#3C3489] hover:bg-[#e0defe]',
    danger:  'border-[#f9d7d7] bg-[#FCEBEB] text-[#791F1F] hover:bg-[#f9d7d7]',
    success: 'border-[#c8e6c9] bg-[#EAF3DE] text-[#27500A] hover:bg-[#d9edd9]',
    warn:    'border-[#f5d193] bg-[#FAEEDA] text-[#633806] hover:bg-[#f5d193]',
  }[v]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex text-[10px] px-2 py-1 rounded border min-h-[28px] items-center transition-colors disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Bulk cancel
// ---------------------------------------------------------------------------

function BulkCancelPending({ jobs, onRefresh }: { jobs: EnrichedJob[]; onRefresh: () => void }) {
  const pendingIds = jobs.filter(j => j.status === 'pending').map(j => j.id)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (pendingIds.length === 0) return null

  async function cancelAll() {
    if (!confirm(`Cancel all ${pendingIds.length} pending jobs?`)) return
    setBusy(true)
    try {
      await Promise.all(pendingIds.map(id =>
        fetch(`/api/admin/jobs/${id}/cancel`, { method: 'POST' })
      ))
      setDone(true)
      onRefresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={cancelAll}
      disabled={busy || done}
      className="text-[10px] px-2.5 py-1.5 rounded border border-[#f9d7d7] bg-[#FCEBEB] text-[#791F1F] hover:bg-[#f9d7d7] disabled:opacity-50 transition-colors min-h-[30px]"
    >
      {done ? 'Cancelled' : busy ? 'Cancelling...' : `Cancel all ${pendingIds.length} pending`}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Pending explanation banner
// ---------------------------------------------------------------------------

function PendingBanner({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#FAEEDA] border border-[#f5d193] text-[11px] text-[#633806]">
      <span className="mt-0.5 shrink-0">&#9432;</span>
      <span>
        <strong>{count} pending</strong> -- queued in the database, waiting for a worker slot.
        If pending jobs do not move to running within a few minutes, the worker process may be down.
        Check PM2 on the VPS: <code className="font-mono bg-[#f5d193]/40 px-1 rounded">pm2 status</code>.
        You can cancel them here and re-trigger via Coverage &amp; Hydrate.
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------

export function JobsTable({ jobs }: { jobs: EnrichedJob[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  // Default to active jobs (running + pending + failed + paused) -- most actionable view
  const [statusFilter, setStatusFilter] = useState('active')

  function refresh() {
    startTransition(() => router.refresh())
  }

  const filtered = statusFilter === 'all'
    ? jobs
    : statusFilter === 'active'
    ? jobs.filter(j => ACTIVE_STATUSES.has(j.status))
    : jobs.filter(j => j.status === statusFilter)

  const visible = sortJobs(filtered)
  const pendingCount = visible.filter(j => j.status === 'pending').length

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
        >
          <option value="active">Active (running / pending / failed / paused)</option>
          <option value="all">All statuses</option>
          <option value="running">Running</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-[11px] text-gray-400">{visible.length} jobs</span>
        <BulkCancelPending jobs={visible} onRefresh={refresh} />
        <button
          onClick={refresh}
          className="ml-auto text-[11px] text-[#534AB7] hover:underline"
        >
          Refresh
        </button>
      </div>

      <PendingBanner count={pendingCount} />

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {visible.length === 0 ? (
          <p className="text-[12px] text-gray-400 py-10 text-center">
            {statusFilter === 'active' ? 'No active jobs -- everything is completed or cancelled.' : 'No jobs found.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                  {['Job ID', 'Type', 'Subject', 'Gr.', 'Progress', 'Age', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visible.map(job => {
                  const pct = jobProgress(job)
                  const isStuck = job.status === 'running' && job.lockedAt
                    && (Date.now() - new Date(job.lockedAt).getTime()) > 2 * 60 * 60 * 1000
                  return (
                    <tr
                      key={job.id}
                      className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/30 ${isStuck ? 'bg-[#FAEEDA]/30' : ''}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500">
                        {job.id.substring(0, 8)}
                        {isStuck && (
                          <span className="ml-1 text-[8px] text-[#633806] font-semibold uppercase">stuck</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 capitalize">
                        {job.jobType}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                        {job.subjectName}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">{job.grade || '--'}</td>
                      <td className="px-3 py-2.5 w-28">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#534AB7] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 w-7 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                        {timeSince(new Date(job.createdAt))}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={job.status} />
                        {job.lastError && (
                          <p className="text-[9px] text-[#E24B4A] mt-0.5 max-w-[100px] truncate" title={job.lastError}>
                            {job.lastError}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <JobActions job={job} onRefresh={refresh} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
