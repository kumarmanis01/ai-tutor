import React from 'react'
import { requireAdminOrModerator } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
import ExecuteRetryButton from '@/app/admin/retry-intents/ExecuteRetryButton'
import ReadOnlyJsonViewer from '@/components/UI/ReadOnlyJsonViewer'

type Props = { params: { id: string } }

export default async function Page({ params }: Props) {
  await requireAdminOrModerator()
  const { id } = params
  const intent = await prisma.retryIntent.findUnique({ where: { id } })
  if (!intent) return (<div style={{ padding: 24 }}><h1>RetryIntent not found</h1></div>)

  return (
    <div style={{ padding: 24 }}>
      <h1 className="text-2xl font-bold mb-4">Retry Intent {intent.id}</h1>
      <div style={{ marginBottom: 8 }}><strong>Status:</strong> {intent.status}</div>
      <div style={{ marginBottom: 8 }}><strong>Source Job:</strong> {intent.sourceJobId}</div>
      <div style={{ marginBottom: 8 }}><strong>Reason:</strong> {intent.reasonCode} — {intent.reasonText}</div>
      <div style={{ marginBottom: 8 }}><strong>Approved By:</strong> {intent.approvedBy} {intent.approvedAt ? `on ${new Date(intent.approvedAt).toLocaleString()}` : ''}</div>
      <div style={{ marginTop: 16 }}>
        {intent.status === 'PENDING' ? (
          <ExecuteRetryButton intentId={intent.id} />
        ) : (
          <div className="text-sm text-gray-600">Execute disabled — status is {intent.status}</div>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <h3 className="text-lg font-semibold">Full JSON</h3>
        <ReadOnlyJsonViewer data={intent} collapsedByDefault={false} />
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 className="text-lg font-semibold">Audit Trail</h3>
        {/* Server-render audit logs by calling admin API for audit logs */}
        <AuditTrail entityId={intent.id} />
      </div>
    </div>
  )
}

async function fetchAuditLogs(entityId: string) {
  try {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
    return logs.filter((a: any) => {
      const d: any = a.details ?? {}
      if (a.id === entityId) return true
      if (d.entityId === entityId) return true
      if (d.retryIntentId === entityId) return true
      if (d.sourceJobId === entityId) return true
      return false
    })
  } catch {
    return []
  }
}

function AuditTrailClient({ logs }: { logs: any[] }) {
  if (!logs || logs.length === 0) return <div className="text-sm text-gray-600">No audit events found.</div>
  return (
    <div className="mt-2">
      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="border px-3 py-1">Time</th>
            <th className="border px-3 py-1">Actor</th>
            <th className="border px-3 py-1">Action</th>
            <th className="border px-3 py-1">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l: any) => (
            <tr key={l.id} className="border-t">
              <td className="border px-3 py-1">{new Date(l.createdAt).toLocaleString()}</td>
              <td className="border px-3 py-1">{l.actorId ?? l.actor ?? '-'}</td>
              <td className="border px-3 py-1">{l.action}</td>
              <td className="border px-3 py-1"><ReadOnlyJsonViewer data={l.details ?? {}} collapsedByDefault={true} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Wrapper to run fetch on server and render client component
async function AuditTrail({ entityId }: { entityId: string }) {
  const logs = await fetchAuditLogs(entityId)
  return <AuditTrailClient logs={logs} />
}
