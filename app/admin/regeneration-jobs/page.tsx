import React from 'react'
import Link from 'next/link'
import { requireAdminOrModerator } from '@/lib/auth'

type JobRow = {
  id: string
  status: string
  targetType: string | null
  targetId: string | null
  createdAt: string
  createdBy: string | null
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'COMPLETED'
      ? 'bg-green-200 text-green-800'
      : status === 'PENDING'
      ? 'bg-yellow-200 text-yellow-800'
      : status === 'FAILED'
      ? 'bg-red-200 text-red-800'
      : 'bg-gray-200 text-gray-800'
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{status}</span>
}

export default async function Page() {
  await requireAdminOrModerator()

  const res = await fetch('/api/admin/regeneration-jobs', { cache: 'no-store' })
  if (!res.ok) {
    throw new Error('Failed to load regeneration jobs')
  }
  const jobs: JobRow[] = await res.json()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Regeneration Jobs</h1>
      <div className="overflow-auto">
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-4 py-2">ID</th>
              <th className="border px-4 py-2">Status</th>
              <th className="border px-4 py-2">Target Type</th>
              <th className="border px-4 py-2">Target ID</th>
              <th className="border px-4 py-2">Created At</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-gray-200">
                <td className="border px-4 py-2">
                  <Link href={`/admin/regeneration-jobs/${j.id}`} className="text-blue-600 underline">
                    {j.id}
                  </Link>
                </td>
                <td className="border px-4 py-2"><StatusBadge status={j.status} /></td>
                <td className="border px-4 py-2">{j.targetType ?? '-'}</td>
                <td className="border px-4 py-2">{j.targetId ?? '-'}</td>
                <td className="border px-4 py-2">{new Date(j.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

