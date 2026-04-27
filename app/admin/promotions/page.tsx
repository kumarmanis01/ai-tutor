import React from 'react'
import { requireAdminOrModerator } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
import Link from 'next/link'

export default async function PromotionsList() {
  await requireAdminOrModerator()
  // simple list: fetch latest 200 candidates
  const candidates = await prisma.promotionCandidate.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })

  return (
    <div style={{ padding: 20 }}>
      <h1 className="text-2xl font-bold mb-4">Promotion Candidates</h1>
      <div className="mb-4">
        <Link href="/admin/promotions">All</Link>
      </div>

      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="border px-3 py-1">Scope</th>
            <th className="border px-3 py-1">Ref</th>
            <th className="border px-3 py-1">OutputRef</th>
            <th className="border px-3 py-1">Status</th>
            <th className="border px-3 py-1">Created</th>
            <th className="border px-3 py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c: any) => (
            <tr key={c.id} className="border-t">
              <td className="border px-3 py-1">{c.scope}</td>
              <td className="border px-3 py-1">{c.scopeRefId}</td>
              <td className="border px-3 py-1" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.outputRef}</td>
              <td className="border px-3 py-1">{c.status}</td>
              <td className="border px-3 py-1">{new Date(c.createdAt).toLocaleString()}</td>
              <td className="border px-3 py-1"><Link href={`/admin/promotions/${c.id}`} className="text-blue-600">View</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
