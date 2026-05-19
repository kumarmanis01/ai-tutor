/*
 * FILE OBJECTIVE:
 * - Client component for admin user detail actions (edit, block, delete).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/users/StudentsTable.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | copilot | added from release_20260430 with API path adjustments
 * - 2026-05-19T00:00:00Z | claude  | fix: auto-corrected smart-quote comment to ASCII apostrophe
 */

'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface UserDetail {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  grade: string | null
  board: string | null
  age: number | null
  // 'isAdult' removed -- use `age` alone for display logic
  accountStatus: string
  subscriptionStatus: string
  subscriptionExpiry: string | null
  role: string
  totalXp: number
  level: number
  currentStreak: number
  lastSessionDate: string | null
  createdAt: string
  schoolName: string | null
  subjects: string[]
}

function statusBadge(s: string) {
  switch (s) {
    case 'active':
      return 'bg-[#EAF3DE] text-[#27500A]'
    case 'suspended':
      return 'bg-[#FCEBEB] text-[#7A1B1A]'
    case 'deletion_pending':
      return 'bg-[#FAEEDA] text-[#633806]'
    default:
      return 'bg-gray-100 text-gray-500'
  }
}

function ConfirmModal({ title, message, confirmLabel, confirmCls, onConfirm, onCancel, busy }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="text-[12px] text-gray-600 dark:text-gray-400">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={busy} className="px-4 py-2 text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl min-h-[36px] transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className={`px-4 py-2 text-[12px] rounded-xl min-h-[36px] transition-colors text-white disabled:opacity-50 ${confirmCls}`}>{busy ? 'Processing...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ user, onSave, onCancel, busy }: any) {
  const [name, setName] = useState(user.name ?? '')
  const [subscriptionStatus, setSubscriptionStatus] = useState(user.subscriptionStatus)
  const [schoolName, setSchoolName] = useState(user.schoolName ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Edit user</h2>
        <div className="space-y-3">
          <label className="block"><span className="text-[11px] text-gray-500 dark:text-gray-400">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#534AB7]" />
          </label>
          <label className="block"><span className="text-[11px] text-gray-500 dark:text-gray-400">School</span>
            <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#534AB7]" />
          </label>
          <label className="block"><span className="text-[11px] text-gray-500 dark:text-gray-400">Subscription</span>
            <select value={subscriptionStatus} onChange={(e) => setSubscriptionStatus(e.target.value)} className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#534AB7]">
              <option value="free">Free</option>
              <option value="trial">Trial</option>
              <option value="paid">Paid</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={busy} className="px-4 py-2 text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl min-h-[36px] transition-colors">Cancel</button>
          <button onClick={() => onSave({ name: name.trim() || undefined, subscriptionStatus, schoolName: schoolName.trim() || undefined })} disabled={busy} className="px-4 py-2 text-[12px] bg-[#534AB7] text-white rounded-xl min-h-[36px] hover:bg-[#3C3489] disabled:opacity-50 transition-colors">{busy ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

export function UserDetailClient({ user: initial }: { user: UserDetail }) {
  const router = useRouter()
  const [user, setUser] = useState<UserDetail>(initial)
  const [modal, setModal] = useState<'edit' | 'block' | 'unblock' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function callApi(path: string, method: string, body?: object) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = (await res.json()) as { ok?: boolean; user?: UserDetail; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'request_failed')
      return data
    } finally {
      setBusy(false)
    }
  }

  async function handleSave(fields: { name?: string; subscriptionStatus?: string; schoolName?: string }) {
    try {
      const data = await callApi('', 'PATCH', fields)
      if (data.user) setUser(data.user)
      setModal(null)
      showToast('User updated.', true)
    } catch {
      showToast("Couldn't update. Check logs.", false)
    }
  }

  async function handleBlock() {
    try {
      await callApi('/block', 'POST')
      setUser((u) => ({ ...u, accountStatus: 'suspended' }))
      setModal(null)
      showToast('User blocked.', true)
    } catch {
      showToast("Couldn't block user. Check logs.", false)
    }
  }

  async function handleUnblock() {
    try {
      await callApi('/unblock', 'POST')
      setUser((u) => ({ ...u, accountStatus: 'active' }))
      setModal(null)
      showToast('User unblocked.', true)
    } catch {
      showToast("Couldn't unblock user. Check logs.", false)
    }
  }

  async function handleDelete() {
    try {
      await callApi('', 'DELETE')
      setUser((u) => ({ ...u, accountStatus: 'deletion_pending' }))
      setModal(null)
      showToast('Deletion request queued.', true)
      setTimeout(() => router.push('/admin/users'), 1200)
    } catch {
      showToast("Couldn't delete user. Check logs.", false)
    }
  }

  const isBlocked = user.accountStatus === 'suspended'
  const isPendingDeletion = user.accountStatus === 'deletion_pending'

  return (
    <>
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl text-[12px] font-medium shadow-lg ${toast.ok ? 'bg-[#EAF3DE] text-[#1D4D00]' : 'bg-[#FCEBEB] text-[#7A1B1A]'}`}>
          {toast.msg}
        </div>
      )}

      {modal === 'edit' && <EditModal user={user} onSave={handleSave} onCancel={() => setModal(null)} busy={busy} />}
      {modal === 'block' && (
        <ConfirmModal title="Block user" message={`Block ${user.name ?? user.email ?? user.id}? They will not be able to log in.`} confirmLabel="Block user" confirmCls="bg-[#E24B4A] hover:bg-[#c03a39]" onConfirm={handleBlock} onCancel={() => setModal(null)} busy={busy} />
      )}
      {modal === 'unblock' && (
        <ConfirmModal title="Unblock user" message={`Restore access for ${user.name ?? user.email ?? user.id}?`} confirmLabel="Unblock user" confirmCls="bg-[#1D9E75] hover:bg-[#178060]" onConfirm={handleUnblock} onCancel={() => setModal(null)} busy={busy} />
      )}
      {modal === 'delete' && (
        <ConfirmModal title="Delete user" message={`Queue deletion for ${user.name ?? user.email ?? user.id}? This marks the account for permanent removal.`} confirmLabel="Delete user" confirmCls="bg-[#E24B4A] hover:bg-[#c03a39]" onConfirm={handleDelete} onCancel={() => setModal(null)} busy={busy} />
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#EEEDFE] flex items-center justify-center text-lg font-semibold text-[#534AB7] shrink-0">
              {user.name ? user.name.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase() : (user.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">{user.name ?? <em className="text-gray-400 font-normal">No name</em>}</h1>
              <p className="text-[11px] text-gray-500">{user.email ?? user.phone ?? 'No contact'}</p>
            </div>
          </div>

          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(user.accountStatus)}`}>{user.accountStatus.replace('_', ' ')}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoRow label="Grade / Board" value={[user.grade && `Grade ${user.grade}`, user.board?.toUpperCase()].filter(Boolean).join(' · ') || '--'} />
          <InfoRow label="Age" value={user.age ? `${user.age}y` : '--'} />
          <InfoRow label="School" value={user.schoolName ?? '--'} />
          <InfoRow label="Subjects" value={user.subjects.length > 0 ? user.subjects.join(', ') : '--'} />
          <InfoRow label="Subscription" value={user.subscriptionStatus} />
          <InfoRow label="XP / Level" value={`${user.totalXp.toLocaleString()} XP · L${user.level}`} />
          <InfoRow label="Streak" value={`${user.currentStreak} days`} />
          <InfoRow label="Last session" value={user.lastSessionDate ? new Date(user.lastSessionDate).toLocaleDateString('en-IN') : 'Never'} />
          <InfoRow label="Joined" value={new Date(user.createdAt).toLocaleDateString('en-IN')} />
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <button onClick={() => setModal('edit')} disabled={isPendingDeletion} className="px-3 py-1.5 text-[11px] rounded-lg border border-[#534AB7] bg-[#EEEDFE] text-[#3C3489] hover:bg-[#e0defe] min-h-[32px] transition-colors disabled:opacity-40">Edit</button>

          {isBlocked ? (
            <button onClick={() => setModal('unblock')} disabled={isPendingDeletion} className="px-3 py-1.5 text-[11px] rounded-lg border border-[#1D9E75] bg-[#EAF3DE] text-[#27500A] hover:bg-[#d5ecca] min-h-[32px] transition-colors disabled:opacity-40">Unblock</button>
          ) : (
            <button onClick={() => setModal('block')} disabled={isPendingDeletion} className="px-3 py-1.5 text-[11px] rounded-lg border border-[#E24B4A] bg-[#FCEBEB] text-[#7A1B1A] hover:bg-[#f7d6d6] min-h-[32px] transition-colors disabled:opacity-40">Block</button>
          )}

          <button onClick={() => setModal('delete')} disabled={isPendingDeletion} className="px-3 py-1.5 text-[11px] rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[32px] transition-colors disabled:opacity-40">Delete</button>
        </div>
      </div>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-[12px] text-gray-800 dark:text-gray-200 mt-0.5 truncate">{value}</p>
    </div>
  )
}
