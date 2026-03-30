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

function jobProgress(job: EnrichedJob): number {
  const expected = job.chaptersExpected + job.notesExpected + job.questionsExpected
  const done = job.chaptersCompleted + job.notesCompleted + job.questionsCompleted
  if (expected === 0) return job.status === 'completed' ? 100 : 0
  return Math.round((done / expected) * 100)
}

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

  async function call(url: string, method = 'POST') {
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch(url, { method })
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
    <div className="flex items-center gap-1">
      {err && <span className="text-[9px] text-[#E24B4A] mr-1">{err}</span>}

      {status === 'running' && (
        <>
          <Btn onClick={() => call(`/api/admin/jobs/${id}/pause`)} disabled={busy} v="warn">Pause</Btn>
          <Btn onClick={() => call(`/api/admin/jobs/${id}/cancel`)} disabled={busy} v="danger">Cancel</Btn>
        </>
      )}
      {status === 'paused' && (
        <>
          <Btn onClick={() => call(`/api/admin/jobs/${id}/resume`)} disabled={busy} v="primary">Resume</Btn>
          <Btn onClick={() => call(`/api/admin/jobs/${id}/cancel`)} disabled={busy} v="danger">Cancel</Btn>
        </>
      )}
      {status === 'failed' && (
        <>
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
        </>
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
// Main table
// ---------------------------------------------------------------------------

export function JobsTable({ jobs }: { jobs: EnrichedJob[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState('all')

  function refresh() {
    startTransition(() => router.refresh())
  }

  const visible = statusFilter === 'all'
    ? jobs
    : jobs.filter(j => j.status === statusFilter)

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
        >
          {['all', 'running', 'pending', 'completed', 'failed', 'paused', 'cancelled'].map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
          ))}
        </select>
        <span className="text-[11px] text-gray-400">{visible.length} jobs</span>
        <button
          onClick={refresh}
          className="ml-auto text-[11px] text-[#534AB7] hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {visible.length === 0 ? (
          <p className="text-[12px] text-gray-400 py-10 text-center">No jobs found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                  {['Job ID', 'Type', 'Subject', 'Gr.', 'Progress', 'Started', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visible.map(job => {
                  const pct = jobProgress(job)
                  return (
                    <tr key={job.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500">
                        {job.id.substring(0, 8)}
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
