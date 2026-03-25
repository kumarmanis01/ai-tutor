'use client'

import React, { useState } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentRowData {
  id: string
  name: string | null
  email: string | null
  grade: string | null
  board: string | null
  age: number | null
  accountStatus: string
  subscriptionStatus: string
  totalXp: number
  level: number
  lastSessionDate: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string | null, email: string | null): string {
  if (name) return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

function statusLabel(student: StudentRowData): { text: string; cls: string } {
  if (student.accountStatus === 'pending_parent_verification') {
    return { text: 'Pending OTP', cls: 'bg-[#FAEEDA] text-[#633806]' }
  }
  if (student.lastSessionDate) {
    const daysSince = Math.floor(
      (Date.now() - new Date(student.lastSessionDate).getTime()) / 86400000
    )
    if (daysSince < 7) {
      return { text: 'Active', cls: 'bg-[#EAF3DE] text-[#27500A]' }
    }
    return { text: `Inactive ${daysSince}d`, cls: 'bg-gray-100 text-gray-500' }
  }
  return { text: 'No sessions', cls: 'bg-gray-100 text-gray-400' }
}

// ---------------------------------------------------------------------------
// Notification modal
// ---------------------------------------------------------------------------

function NotifyModal({
  student,
  onClose,
}: {
  student: StudentRowData
  onClose: () => void
}) {
  const [type, setType] = useState<'email' | 'push'>('email')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'ok' | 'err' | null>(null)

  async function send() {
    setBusy(true)
    setResult(null)
    try {
      const r = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: student.id, type, title, body }),
      })
      setResult(r.ok ? 'ok' : 'err')
      if (r.ok) setTimeout(onClose, 800)
    } catch {
      setResult('err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Notify student
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {student.name ?? ''} &middot; {student.email ?? student.id}
          </p>
        </div>

        {/* Channel */}
        <div className="flex gap-2">
          {(['email', 'push'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2 text-[12px] rounded-lg min-h-[36px] transition-colors font-medium ${
                type === t
                  ? 'bg-[#534AB7] text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              {t === 'email' ? 'Email' : 'Push'}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
        />

        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Message"
          rows={3}
          className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#534AB7] resize-none"
        />

        {result === 'ok' && <p className="text-[11px] text-[#1D9E75]">Notification sent.</p>}
        {result === 'err' && <p className="text-[11px] text-[#E24B4A]">Failed to send. Check logs.</p>}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl min-h-[36px] transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!title.trim() || !body.trim() || busy}
            onClick={send}
            className="px-4 py-2 text-[12px] bg-[#534AB7] text-white rounded-xl disabled:opacity-50 min-h-[36px] hover:bg-[#3C3489] transition-colors"
          >
            {busy ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function StudentRow({
  student,
  onNotify,
}: {
  student: StudentRowData
  onNotify: (s: StudentRowData) => void
}) {
  const status = statusLabel(student)
  const ini = initials(student.name, student.email)
  const isPaid = student.subscriptionStatus !== 'free'

  return (
    <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#EEEDFE] flex items-center justify-center text-[11px] font-semibold text-[#534AB7] shrink-0">
            {ini}
          </div>
          <div>
            <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200">
              {student.name ?? <em className="text-gray-400">No name</em>}
            </p>
            <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{student.email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">
        {student.grade ? `Grade ${student.grade}` : '--'}
        {student.board ? ` \u00b7 ${student.board.toUpperCase()}` : ''}
        {student.age ? ` \u00b7 ${student.age}y` : ''}
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${status.cls}`}>
          {status.text}
        </span>
        {isPaid && (
          <span className="ml-1 inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EEEDFE] text-[#3C3489]">
            Paid
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-[11px] text-gray-500">
        {student.totalXp.toLocaleString()} XP &middot; L{student.level}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/admin/users/${student.id}`}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[28px] items-center transition-colors"
          >
            View
          </Link>
          <button
            onClick={() => onNotify(student)}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-[#534AB7] bg-[#EEEDFE] text-[#3C3489] hover:bg-[#e0defe] min-h-[28px] items-center transition-colors"
          >
            Notify
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------

export function StudentsTable({ students }: { students: StudentRowData[] }) {
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [boardFilter, setBoardFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [notifyTarget, setNotifyTarget] = useState<StudentRowData | null>(null)

  const visible = students.filter(s => {
    if (search) {
      const q = search.toLowerCase()
      const matchName = s.name?.toLowerCase().includes(q)
      const matchEmail = s.email?.toLowerCase().includes(q)
      if (!matchName && !matchEmail) return false
    }
    if (gradeFilter !== 'all' && s.grade !== gradeFilter) return false
    if (boardFilter !== 'all' && (s.board ?? '').toLowerCase() !== boardFilter) return false
    if (statusFilter !== 'all') {
      const st = statusLabel(s).text.toLowerCase()
      if (statusFilter === 'active' && !st.startsWith('active')) return false
      if (statusFilter === 'inactive' && !st.startsWith('inactive')) return false
      if (statusFilter === 'pending' && !st.includes('pending')) return false
    }
    return true
  })

  const grades = [...new Set(students.map(s => s.grade).filter(Boolean))].sort() as string[]

  return (
    <>
      {notifyTarget && (
        <NotifyModal student={notifyTarget} onClose={() => setNotifyTarget(null)} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or email..."
          className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-52 focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
        />
        <select
          value={gradeFilter}
          onChange={e => setGradeFilter(e.target.value)}
          className="text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
        >
          <option value="all">All grades</option>
          {grades.map(g => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <select
          value={boardFilter}
          onChange={e => setBoardFilter(e.target.value)}
          className="text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
        >
          <option value="all">All boards</option>
          <option value="cbse">CBSE</option>
          <option value="icse">ICSE</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending OTP</option>
        </select>
        <span className="text-[11px] text-gray-400 ml-1">{visible.length} students</span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {visible.length === 0 ? (
          <p className="text-[12px] text-gray-400 py-10 text-center">No students match filters</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                  {['Student', 'Grade / Board', 'Status', 'XP / Level', 'Actions'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(s => (
                  <StudentRow key={s.id} student={s} onNotify={setNotifyTarget} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
