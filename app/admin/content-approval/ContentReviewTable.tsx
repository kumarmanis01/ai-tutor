'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types (shared with page.tsx)
// ---------------------------------------------------------------------------

export type ReviewItemType = 'chapter' | 'topic' | 'note' | 'test'

export interface ReviewItemData {
  id: string
  type: ReviewItemType
  subjectName: string
  boardName: string
  grade: number
  chapterName: string | null
  topicName: string | null
  preview: string
  language: string | null
  difficulty: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<ReviewItemType, string> = {
  chapter: 'Chapter',
  topic: 'Topic',
  note: 'Note',
  test: 'Test',
}

const TYPE_COLORS: Record<ReviewItemType, string> = {
  chapter: 'bg-[#E6F1FB] text-[#0C447C]',
  topic:   'bg-[#FAEEDA] text-[#633806]',
  note:    'bg-[#EAF3DE] text-[#27500A]',
  test:    'bg-[#EEEDFE] text-[#3C3489]',
}

// ---------------------------------------------------------------------------
// Action handler
// ---------------------------------------------------------------------------

async function approveItem(id: string, type: ReviewItemType, action: 'approve' | 'reject') {
  const r = await fetch('/api/admin/content/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, type, action }),
  })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    throw new Error(data.error ?? 'Request failed')
  }
}

// ---------------------------------------------------------------------------
// Single row
// ---------------------------------------------------------------------------

function ReviewRow({
  item,
  onRefresh,
}: {
  item: ReviewItemData
  onRefresh: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function act(action: 'approve' | 'reject') {
    setBusy(true)
    setErr(null)
    try {
      await approveItem(item.id, item.type, action)
      onRefresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  const breadcrumb = [item.subjectName, item.chapterName, item.topicName]
    .filter(Boolean)
    .join(' / ')

  return (
    <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <td className="px-3 py-2.5">
        <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLORS[item.type]}`}>
          {TYPE_LABELS[item.type]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <p className="text-[11px] text-gray-700 dark:text-gray-300 max-w-[180px] truncate" title={breadcrumb}>
          {breadcrumb}
        </p>
        <p className="text-[10px] text-gray-400">
          {item.boardName} &middot; Grade {item.grade}
          {item.language && ` \u00b7 ${item.language.toUpperCase()}`}
          {item.difficulty && ` \u00b7 ${item.difficulty}`}
        </p>
      </td>
      <td className="px-3 py-2.5 max-w-[260px]">
        <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate" title={item.preview}>
          {item.preview || <em className="text-gray-400">No preview</em>}
        </p>
      </td>
      <td className="px-3 py-2.5 text-[10px] text-gray-400 whitespace-nowrap">
        {new Date(item.createdAt).toLocaleDateString()}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {err && <span className="text-[9px] text-[#E24B4A]">{err}</span>}
          <button
            onClick={() => act('approve')}
            disabled={busy}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-[#c8e6c9] bg-[#EAF3DE] text-[#27500A] hover:bg-[#d9edd9] disabled:opacity-50 min-h-[28px] transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => act('reject')}
            disabled={busy}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-[#f9d7d7] bg-[#FCEBEB] text-[#791F1F] hover:bg-[#f9d7d7] disabled:opacity-50 min-h-[28px] transition-colors"
          >
            Reject
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Table with filters + bulk approve
// ---------------------------------------------------------------------------

export function ContentReviewTable({ items }: { items: ReviewItemData[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [typeFilter, setTypeFilter] = useState<ReviewItemType | 'all'>('all')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [bulkBusy, setBulkBusy] = useState(false)

  function refresh() {
    startTransition(() => router.refresh())
  }

  const subjects = [...new Set(items.map(i => i.subjectName))].sort()

  const visible = items.filter(i => {
    if (typeFilter !== 'all' && i.type !== typeFilter) return false
    if (subjectFilter !== 'all' && i.subjectName !== subjectFilter) return false
    return true
  })

  async function bulkApprove() {
    setBulkBusy(true)
    try {
      await Promise.all(visible.map(i => approveItem(i.id, i.type, 'approve')))
      refresh()
    } catch {
      // individual row errors surface per-row on refresh
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as ReviewItemType | 'all')}
          className="text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
        >
          <option value="all">All types</option>
          <option value="chapter">Chapters</option>
          <option value="topic">Topics</option>
          <option value="note">Notes</option>
          <option value="test">Tests</option>
        </select>

        <select
          value={subjectFilter}
          onChange={e => setSubjectFilter(e.target.value)}
          className="text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
        >
          <option value="all">All subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <span className="text-[11px] text-gray-400 ml-1">
          {visible.length} item{visible.length === 1 ? '' : 's'}
        </span>

        <div className="ml-auto">
          {visible.length > 0 && (
            <button
              onClick={bulkApprove}
              disabled={bulkBusy}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-[#EAF3DE] text-[#27500A] border border-[#c8e6c9] hover:bg-[#d9edd9] disabled:opacity-50 min-h-[32px] transition-colors"
            >
              {bulkBusy ? 'Approving...' : `Approve all ${visible.length}`}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {visible.length === 0 ? (
          <p className="text-[12px] text-gray-400 py-10 text-center">
            No items pending review
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                  {['Type', 'Subject / Chapter', 'Preview', 'Created', 'Actions'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(item => (
                  <ReviewRow key={item.id} item={item} onRefresh={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
