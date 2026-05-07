'use client'

import React, { useState } from 'react'
import { DPDP_MINOR_AGE } from '@/lib/constants/age'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParentRowData {
  id: string                // ParentStudent link id
  parentId: string
  parentName: string | null
  parentEmail: string | null
  studentId: string
  studentName: string | null
  studentGrade: string | null
  verifiedAt: string | null
  requiresVerification: boolean
  avgMastery: number       // 0-100
}

// ---------------------------------------------------------------------------
// Readiness bar
// ---------------------------------------------------------------------------

function ReadinessBar({ pct }: { pct: number }) {
  const color =
    pct >= 70 ? 'bg-[#1D9E75]' : pct >= 40 ? 'bg-[#BA7517]' : 'bg-[#E24B4A]'
  const labelCls =
    pct >= 70 ? 'text-[#27500A]' : pct >= 40 ? 'text-[#633806]' : 'text-[#791F1F]'
  return (
    <div className="flex items-center gap-1.5 w-28">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-medium w-7 text-right ${labelCls}`}>{pct}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function ParentRow({ row }: { row: ParentRowData }) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState(false)

  const isVerified = !!row.verifiedAt
  const verifiedCls = isVerified
    ? 'bg-[#EAF3DE] text-[#27500A]'
    : 'bg-[#FAEEDA] text-[#633806]'

  async function sendReport() {
    setBusy(true)
    setSent(false)
    setErr(false)
    try {
      const r = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: row.parentId,
          type: 'email',
          title: `${row.studentName ?? 'Your child'}'s weekly learning report`,
          body: `Weekly learning summary for ${row.studentName ?? 'your child'}.`,
        }),
      })
      if (r.ok) setSent(true)
      else setErr(true)
    } catch {
      setErr(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <td className="px-3 py-2.5">
        <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200">
          {row.parentName ?? <em className="text-gray-400">No name</em>}
        </p>
        <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{row.parentEmail}</p>
      </td>
      <td className="px-3 py-2.5 text-[11px] text-gray-600 dark:text-gray-400">
        {row.studentName ?? '--'}
        {row.studentGrade ? ` (Gr. ${row.studentGrade})` : ''}
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${verifiedCls}`}>
          {isVerified ? 'Verified' : 'Unverified'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <ReadinessBar pct={row.avgMastery} />
      </td>
      <td className="px-3 py-2.5 text-[10px] text-gray-400">--</td>
      <td className="px-3 py-2.5">
        {sent && <span className="text-[10px] text-[#1D9E75]">Sent</span>}
        {err && <span className="text-[10px] text-[#E24B4A]">Error</span>}
        {!sent && !err && (
          <button
            onClick={sendReport}
            disabled={busy}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-[#534AB7] bg-[#EEEDFE] text-[#3C3489] hover:bg-[#e0defe] min-h-[28px] items-center disabled:opacity-50 transition-colors"
          >
            {busy ? 'Sending...' : 'Send report'}
          </button>
        )}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------

export function ParentsTable({ rows }: { rows: ParentRowData[] }) {
  const [broadcastBusy, setBroadcastBusy] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null)

  async function broadcastDigest() {
    setBroadcastBusy(true)
    setBroadcastResult(null)
    try {
      const r = await fetch('/api/admin/notifications/broadcast-digest', { method: 'POST' })
      const data = await r.json().catch(() => ({}))
      if (r.ok) {
        setBroadcastResult(`Digest queued for ${data.queued ?? '?'} parents`)
      } else {
        setBroadcastResult('Failed to broadcast digest')
      }
    } catch {
      setBroadcastResult('Network error')
    } finally {
      setBroadcastBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Broadcast button */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400">{rows.length} linked parent{rows.length === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-3">
          {broadcastResult && (
            <span className="text-[11px] text-gray-500">{broadcastResult}</span>
          )}
          <button
            onClick={broadcastDigest}
            disabled={broadcastBusy || rows.length === 0}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-[#534AB7] text-white hover:bg-[#3C3489] disabled:opacity-50 min-h-[32px] transition-colors"
          >
            {broadcastBusy ? 'Sending...' : 'Send digest now'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <div className="w-10 h-10 rounded-full bg-[#EEEDFE] flex items-center justify-center text-[#534AB7] text-lg font-bold mb-3">
              P
            </div>
            <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">
              No parents linked yet
            </p>
            <p className="text-[11px] text-gray-400 max-w-xs mb-3">
              Parents link via the parent verification flow when a student under {DPDP_MINOR_AGE} adds a parent email during onboarding.
            </p>
            <div className="text-[10px] text-gray-400 space-y-0.5 text-left">
              <p>1. Student age &lt; {DPDP_MINOR_AGE} -- parent email required</p>
              <p>2. Parent receives OTP email -- verifies</p>
              <p>3. Link created with status &quot;active&quot;</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                  {['Parent', 'Child', 'Verified', 'Readiness', 'Last digest', 'Actions'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => <ParentRow key={row.id} row={row} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
