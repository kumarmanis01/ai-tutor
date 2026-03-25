'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { timeSince } from '@/lib/admin/formatters'

// ---------------------------------------------------------------------------
// Shared types (also imported by page.tsx)
// ---------------------------------------------------------------------------

export type ContentStatus =
  | 'not_started'
  | 'ncert_only'
  | 'syllabus_only'
  | 'generating'
  | 'ready'
  | 'failed'

export interface CoverageRowData {
  subjectId: string
  subjectName: string
  subjectSlug: string
  grade: number
  boardName: string
  boardSlug: string
  language: string
  chapterCount: number
  topicCount: number
  questionCount: number
  ragChunks: number
  status: ContentStatus
  jobId: string | null
  jobStatus: string | null
  jobError: string | null
  chaptersExpected: number
  chaptersCompleted: number
  topicsExpected: number
  topicsCompleted: number
  notesExpected: number
  notesCompleted: number
  questionsExpected: number
  questionsCompleted: number
}

export interface PipelineJobData {
  id: string
  subjectName: string
  boardSlug: string
  grade: number
  status: string
  chaptersExpected: number
  chaptersCompleted: number
  topicsExpected: number
  topicsCompleted: number
  notesExpected: number
  notesCompleted: number
  questionsExpected: number
  questionsCompleted: number
  createdAt: string
}

export interface IngestRunData {
  id: string
  runAt: string
  subjectName: string
  grade: number | null
  fileSource: string | null
  chunksCreated: number
  chunksUpdated: number
  embeddingsGenerated: number
  errors: number
  durationMs: number | null
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CFG: Record<ContentStatus, { bg: string; text: string; label: string }> = {
  not_started:   { bg: 'bg-[#FAEEDA]', text: 'text-[#633806]', label: 'Not started' },
  ncert_only:    { bg: 'bg-[#E6F1FB]', text: 'text-[#0C447C]', label: 'NCERT only' },
  syllabus_only: { bg: 'bg-[#FAEEDA]', text: 'text-[#633806]', label: 'Syllabus only' },
  generating:    { bg: 'bg-[#E6F1FB]', text: 'text-[#0C447C]', label: 'Generating...' },
  ready:         { bg: 'bg-[#EAF3DE]', text: 'text-[#27500A]', label: 'Ready' },
  failed:        { bg: 'bg-[#FCEBEB]', text: 'text-[#791F1F]', label: 'Failed' },
}

function ContentStatusBadge({ status }: { status: ContentStatus }) {
  const { bg, text, label } = STATUS_CFG[status]
  return (
    <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${bg} ${text}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ completed, expected }: { completed: number; expected: number }) {
  const pct = expected > 0 ? Math.min(100, Math.round((completed / expected) * 100)) : 0
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
      <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#534AB7] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span>{completed}/{expected}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action buttons row per coverage row
// ---------------------------------------------------------------------------

function RowActions({
  row,
  onRefresh,
}: {
  row: CoverageRowData
  onRefresh: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(url: string, body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Request failed')
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerate() {
    await call('/api/admin/content/hydrate', {
      subjectId: row.subjectId,
      board: row.boardSlug,
      grade: row.grade,
      language: row.language,
    })
  }

  async function handleIngest() {
    await call('/api/admin/content/ingest-ncert', {
      subjectId: row.subjectId,
      board: row.boardSlug,
      grade: row.grade,
      language: row.language,
    })
  }

  async function handleRetry() {
    if (!row.jobId) return
    await call('/api/admin/content/retry', { jobId: row.jobId })
  }

  async function handleReset() {
    // Two-step: first fetch counts, then confirm
    const r = await fetch('/api/admin/content/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId: row.subjectId, confirmed: false }),
    })
    const data = await r.json()
    if (!data.requiresConfirmation) return

    const { chapters, topics } = data.counts
    const ok = window.confirm(
      `Reset ${row.subjectName} Grade ${row.grade}?\n\n` +
      `This will delete:\n- ${chapters} chapters\n- ${topics} topics\n\nThis cannot be undone.`,
    )
    if (!ok) return
    await call('/api/admin/content/reset', { subjectId: row.subjectId, confirmed: true })
  }

  const s = row.status

  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {error && (
        <span className="text-[9px] text-[#E24B4A]">{error}</span>
      )}

      {(s === 'not_started' || s === 'ncert_only') && (
        <>
          <Btn onClick={handleIngest} disabled={busy} variant="default">Ingest NCERT</Btn>
          <Btn onClick={handleGenerate} disabled={busy} variant="primary">Generate all</Btn>
        </>
      )}

      {s === 'syllabus_only' && (
        <>
          <Btn onClick={handleGenerate} disabled={busy} variant="primary">Generate all</Btn>
          <Btn onClick={handleReset} disabled={busy} variant="danger">Reset</Btn>
        </>
      )}

      {s === 'generating' && row.jobId && (
        <>
          <ProgressBar completed={row.chaptersCompleted} expected={row.chaptersExpected} />
          <Link
            href={`/admin/content-engine/jobs/${row.jobId}`}
            className="text-[10px] text-[#534AB7] hover:underline"
          >
            View job
          </Link>
        </>
      )}

      {s === 'failed' && row.jobId && (
        <>
          <Link
            href={`/admin/content-engine/jobs/${row.jobId}`}
            className="inline-flex items-center text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 min-h-[28px]"
          >
            View error
          </Link>
          <Btn onClick={handleRetry} disabled={busy} variant="success">Retry</Btn>
          <Btn onClick={handleReset} disabled={busy} variant="danger">Reset</Btn>
        </>
      )}

      {s === 'ready' && (
        <>
          <Link
            href={`/admin/content-engine/jobs?subjectId=${row.subjectId}`}
            className="inline-flex items-center text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 min-h-[28px]"
          >
            Details
          </Link>
          <Btn onClick={handleReset} disabled={busy} variant="danger">Reset</Btn>
        </>
      )}
    </div>
  )
}

function Btn({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled: boolean
  variant: 'default' | 'primary' | 'danger' | 'success' | 'warn'
}) {
  const cls: Record<string, string> = {
    default: 'border-gray-300 text-gray-600 hover:bg-gray-50',
    primary: 'border-[#534AB7] bg-[#EEEDFE] text-[#3C3489] hover:bg-[#e0defe]',
    danger:  'border-[#f9d7d7] bg-[#FCEBEB] text-[#791F1F] hover:bg-[#f9d7d7]',
    success: 'border-[#c8e6c9] bg-[#EAF3DE] text-[#27500A] hover:bg-[#d9edd9]',
    warn:    'border-[#f5d193] bg-[#FAEEDA] text-[#633806] hover:bg-[#f5d193]',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center text-[10px] px-2 py-1 rounded border min-h-[28px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${cls[variant]}`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Coverage matrix table
// ---------------------------------------------------------------------------

export function CoverageTable({ rows }: { rows: CoverageRowData[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function refresh() {
    startTransition(() => router.refresh())
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
        <p className="text-[12px] text-gray-500">No active subjects found. Add subjects via the curriculum setup.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              {['Subject', 'Grade', 'Board', 'Chapters', 'Topics', 'Questions', 'RAG chunks', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map(row => (
              <tr key={row.subjectId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                  {row.subjectName}
                </td>
                <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{row.grade}</td>
                <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 uppercase text-[10px]">
                  {row.boardSlug}
                </td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{row.chapterCount}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{row.topicCount}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{row.questionCount}</td>
                <td className="px-3 py-2.5 text-gray-500">{row.ragChunks}</td>
                <td className="px-3 py-2.5">
                  <ContentStatusBadge status={row.status} />
                </td>
                <td className="px-3 py-2.5">
                  <RowActions row={row} onRefresh={refresh} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Active pipeline section
// ---------------------------------------------------------------------------

export function PipelineSection({ jobs }: { jobs: PipelineJobData[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  if (jobs.length === 0) return null

  function pct(completed: number, expected: number) {
    return expected > 0 ? Math.min(100, Math.round((completed / expected) * 100)) : 0
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300">
        Active pipeline ({jobs.length} running)
      </p>
      {jobs.map(job => (
        <div
          key={job.id}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200">
              {job.subjectName} &mdash; Grade {job.grade} ({job.boardSlug.toUpperCase()})
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">{timeSince(new Date(job.createdAt))}</span>
              <Link
                href={`/admin/content-engine/jobs/${job.id}`}
                className="text-[10px] text-[#534AB7] hover:underline"
              >
                View job
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Syllabus', completed: job.chaptersCompleted, expected: job.chaptersExpected },
              { label: 'Topics', completed: job.topicsCompleted, expected: job.topicsExpected },
              { label: 'Notes', completed: job.notesCompleted, expected: job.notesExpected },
              { label: 'Questions', completed: job.questionsCompleted, expected: job.questionsExpected },
            ].map(step => (
              <div key={step.label} className="space-y-1">
                <p className="text-[10px] text-gray-500">{step.label}</p>
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#534AB7] transition-all"
                    style={{ width: `${pct(step.completed, step.expected)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400">
                  {step.completed}/{step.expected > 0 ? step.expected : '?'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button
        onClick={() => startTransition(() => router.refresh())}
        className="text-[11px] text-[#534AB7] hover:underline"
      >
        Refresh status
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ingest runs table
// ---------------------------------------------------------------------------

export function IngestRunsTable({ runs }: { runs: IngestRunData[] }) {
  if (runs.length === 0) {
    return (
      <p className="text-[12px] text-gray-400 dark:text-gray-500 py-4 text-center">
        No ingest runs recorded yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            {['Subject', 'Grade', 'Chunks', 'Updated', 'Embeddings', 'Errors', 'Duration', 'When'].map(h => (
              <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {runs.map(r => (
            <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
              <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200">{r.subjectName}</td>
              <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{r.grade ?? '--'}</td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{r.chunksCreated}</td>
              <td className="px-3 py-2.5 text-gray-500">{r.chunksUpdated}</td>
              <td className="px-3 py-2.5 text-gray-500">{r.embeddingsGenerated}</td>
              <td className="px-3 py-2.5">
                {r.errors > 0 ? (
                  <span className="text-[#E24B4A] font-medium">{r.errors}</span>
                ) : (
                  <span className="text-[#1D9E75]">0</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-gray-500">
                {r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : '--'}
              </td>
              <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                {timeSince(new Date(r.runAt))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
