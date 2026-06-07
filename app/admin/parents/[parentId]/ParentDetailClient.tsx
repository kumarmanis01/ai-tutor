'use client'

/**
 * FILE OBJECTIVE:
 * - Client component for admin parent detail actions (block, unblock, delete,
 *   remove student link). Mirrors the pattern in app/admin/users/[id]/UserDetailClient.tsx.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/parents/[parentId]/ParentDetailClient.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07 | claude | created
 */

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ParentDetail {
  id: string
  name: string | null
  email: string | null
  accountStatus: string
  createdAt: string
  linkedStudents: Array<{
    linkId: string
    studentId: string
    studentName: string | null
    studentGrade: string | null
    verifiedAt: string | null
    avgMastery: number
  }>
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmCls,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string
  message: string
  confirmLabel: string
  confirmCls: string
  onConfirm: () => void
  onCancel: () => void
  busy: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" aria-modal="true" role="dialog" aria-labelledby="confirm-modal-title">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 id="confirm-modal-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="text-[12px] text-gray-600 dark:text-gray-400">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl min-h-[36px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-[12px] rounded-xl min-h-[36px] transition-colors text-white disabled:opacity-50 ${confirmCls}`}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function statusBadge(s: string) {
  switch (s) {
    case 'active': return 'bg-[#EAF3DE] text-[#27500A]'
    case 'suspended': return 'bg-[#FCEBEB] text-[#7A1B1A]'
    case 'deletion_pending': return 'bg-[#FAEEDA] text-[#633806]'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-[12px] text-gray-800 dark:text-gray-200 mt-0.5 truncate">{value}</p>
    </div>
  )
}

export function ParentDetailClient({ parent: initial }: { parent: ParentDetail }) {
  const router = useRouter()
  const [parent, setParent] = useState<ParentDetail>(initial)
  const [modal, setModal] = useState<
    | { type: 'block' }
    | { type: 'unblock' }
    | { type: 'delete' }
    | { type: 'unlink'; studentId: string; studentName: string | null }
    | null
  >(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function callUserApi(path: string, method: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${parent.id}${path}`, { method })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'request_failed')
      return data
    } finally {
      setBusy(false)
    }
  }

  async function handleBlock() {
    try {
      await callUserApi('/block', 'POST')
      setParent((p: ParentDetail) => ({ ...p, accountStatus: 'suspended' }))
      setModal(null)
      showToast('Parent blocked.', true)
    } catch {
      showToast("Couldn't block parent. Check logs.", false)
    }
  }

  async function handleUnblock() {
    try {
      await callUserApi('/unblock', 'POST')
      setParent((p: ParentDetail) => ({ ...p, accountStatus: 'active' }))
      setModal(null)
      showToast('Parent unblocked.', true)
    } catch {
      showToast("Couldn't unblock parent. Check logs.", false)
    }
  }

  async function handleDelete() {
    try {
      await callUserApi('', 'DELETE')
      setParent((p: ParentDetail) => ({ ...p, accountStatus: 'deletion_pending' }))
      setModal(null)
      showToast('Deletion request queued.', true)
      setTimeout(() => router.push('/admin/parents'), 1200)
    } catch {
      showToast("Couldn't delete parent. Check logs.", false)
    }
  }

  async function handleUnlink(studentId: string) {
    setBusy(true)
    try {
      const res = await fetch(
        `/api/admin/parents/${parent.id}/unlink?studentId=${encodeURIComponent(studentId)}`,
        { method: 'DELETE' },
      )
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'request_failed')
      setParent((p: ParentDetail) => ({
        ...p,
        linkedStudents: p.linkedStudents.filter((s: ParentDetail['linkedStudents'][number]) => s.studentId !== studentId),
      }))
      setModal(null)
      showToast('Student unlinked.', true)
    } catch {
      showToast("Couldn't unlink student. Check logs.", false)
    } finally {
      setBusy(false)
    }
  }

  const isBlocked = parent.accountStatus === 'suspended'
  const isPendingDeletion = parent.accountStatus === 'deletion_pending'
  const displayName = parent.name ?? parent.email ?? parent.id

  return (
    <>
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl text-[12px] font-medium shadow-lg ${
            toast.ok ? 'bg-[#EAF3DE] text-[#1D4D00]' : 'bg-[#FCEBEB] text-[#7A1B1A]'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {modal?.type === 'block' && (
        <ConfirmModal
          title="Block parent"
          message={`Block ${displayName}? They will not be able to log in.`}
          confirmLabel="Block parent"
          confirmCls="bg-[#E24B4A] hover:bg-[#c03a39]"
          onConfirm={handleBlock}
          onCancel={() => setModal(null)}
          busy={busy}
        />
      )}
      {modal?.type === 'unblock' && (
        <ConfirmModal
          title="Unblock parent"
          message={`Restore access for ${displayName}?`}
          confirmLabel="Unblock parent"
          confirmCls="bg-[#1D9E75] hover:bg-[#178060]"
          onConfirm={handleUnblock}
          onCancel={() => setModal(null)}
          busy={busy}
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmModal
          title="Delete parent account"
          message={`Queue deletion for ${displayName}? This marks the account for permanent removal.`}
          confirmLabel="Delete account"
          confirmCls="bg-[#E24B4A] hover:bg-[#c03a39]"
          onConfirm={handleDelete}
          onCancel={() => setModal(null)}
          busy={busy}
        />
      )}
      {modal?.type === 'unlink' && (
        <ConfirmModal
          title="Remove student link"
          message={`Remove the parent-student link between ${displayName} and ${modal.studentName ?? 'this student'}? The parent account is not deleted.`}
          confirmLabel="Remove link"
          confirmCls="bg-[#E24B4A] hover:bg-[#c03a39]"
          onConfirm={() => handleUnlink(modal.studentId)}
          onCancel={() => setModal(null)}
          busy={busy}
        />
      )}

      {/* Profile card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#EEEDFE] flex items-center justify-center text-lg font-semibold text-[#534AB7] shrink-0">
              {parent.name
                ? parent.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
                : (parent.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {parent.name ?? <em className="text-gray-400 font-normal">No name</em>}
              </h1>
              <p className="text-[11px] text-gray-500">{parent.email ?? 'No email'}</p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(parent.accountStatus)}`}>
            {parent.accountStatus.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Account status" value={parent.accountStatus.replace(/_/g, ' ')} />
          <InfoRow label="Joined" value={new Date(parent.createdAt).toLocaleDateString('en-IN')} />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          {isBlocked ? (
            <button
              onClick={() => setModal({ type: 'unblock' })}
              disabled={isPendingDeletion}
              className="px-3 py-1.5 text-[11px] rounded-lg border border-[#1D9E75] bg-[#EAF3DE] text-[#27500A] hover:bg-[#d5ecca] min-h-[32px] transition-colors disabled:opacity-40"
            >
              Unblock
            </button>
          ) : (
            <button
              onClick={() => setModal({ type: 'block' })}
              disabled={isPendingDeletion}
              className="px-3 py-1.5 text-[11px] rounded-lg border border-[#E24B4A] bg-[#FCEBEB] text-[#7A1B1A] hover:bg-[#f7d6d6] min-h-[32px] transition-colors disabled:opacity-40"
            >
              Block
            </button>
          )}
          <button
            onClick={() => setModal({ type: 'delete' })}
            disabled={isPendingDeletion}
            className="px-3 py-1.5 text-[11px] rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[32px] transition-colors disabled:opacity-40"
          >
            Delete account
          </button>
        </div>
      </div>

      {/* Linked students */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Linked students ({parent.linkedStudents.length})
        </h2>

        {parent.linkedStudents.length === 0 ? (
          <p className="text-[12px] text-gray-400">No students linked.</p>
        ) : (
          <div className="space-y-2">
            {parent.linkedStudents.map((s: ParentDetail['linkedStudents'][number]) => {
              const verifiedCls = s.verifiedAt
                ? 'bg-[#EAF3DE] text-[#27500A]'
                : 'bg-[#FAEEDA] text-[#633806]'
              const barColor =
                s.avgMastery >= 70 ? 'bg-[#1D9E75]' : s.avgMastery >= 40 ? 'bg-[#BA7517]' : 'bg-[#E24B4A]'
              return (
                <div
                  key={s.linkId}
                  className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200">
                      {s.studentName ?? <em className="text-gray-400">No name</em>}
                      {s.studentGrade ? (
                        <span className="text-gray-400 font-normal"> (Gr. {s.studentGrade})</span>
                      ) : null}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${verifiedCls}`}>
                        {s.verifiedAt ? 'Verified' : 'Unverified'}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${s.avgMastery}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500">{s.avgMastery}%</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setModal({ type: 'unlink', studentId: s.studentId, studentName: s.studentName })
                    }
                    className="px-2.5 py-1 text-[10px] rounded border border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[28px] transition-colors flex-shrink-0"
                  >
                    Remove link
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
