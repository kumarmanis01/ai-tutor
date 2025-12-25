import React from 'react'
import Link from 'next/link'
import { requireAdminOrModerator } from '@/lib/auth'

type IntentRow = {
  id: string
  status: string
  reasonCode: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string | null
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'CONSUMED'
      ? 'bg-gray-200 text-gray-800'
      : status === 'PENDING'
      ? 'bg-yellow-200 text-yellow-800'
      : status === 'REJECTED'
      ? 'bg-red-200 text-red-800'
      : 'bg-gray-200 text-gray-800'
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{status}</span>
}

type Props = { params: { id: string } }

export default async function Page({ params }: Props) {
  await requireAdminOrModerator()

  const { id } = params
  const res = await fetch(`/api/admin/retry-intents?jobId=${encodeURIComponent(id)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load retry intents')
  const payload = await res.json()
  const intents: IntentRow[] = Array.isArray(payload?.intents) ? payload.intents : []

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Retry Intents for Job {id}</h1>
      <div className="overflow-auto">
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-4 py-2">ID</th>
              <th className="border px-4 py-2">Status</th>
              <th className="border px-4 py-2">Reason</th>
              <th className="border px-4 py-2">Approved By</th>
              <th className="border px-4 py-2">Approved At</th>
              <th className="border px-4 py-2">Created At</th>
            </tr>
          </thead>
          <tbody>
            {intents.map((it) => (
              <tr key={it.id} className="border-t border-gray-200">
                <td className="border px-4 py-2">
                  <Link href={`/admin/retry-intents/${it.id}`} className="text-blue-600 underline">
                    {it.id}
                  </Link>
                </td>
                <td className="border px-4 py-2"><StatusBadge status={it.status} /></td>
                <td className="border px-4 py-2">{it.reasonCode ?? '-'}</td>
                <td className="border px-4 py-2">{it.approvedBy ?? '-'}</td>
                <td className="border px-4 py-2">{it.approvedAt ? new Date(it.approvedAt).toLocaleString() : '-'}</td>
                <td className="border px-4 py-2">{it.createdAt ? new Date(it.createdAt).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
