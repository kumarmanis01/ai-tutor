import React from 'react'
import { requireAdminOrModerator } from '@/lib/auth'
import CreateRetryIntent from '@/app/admin/regeneration-jobs/CreateRetryIntent'
import Link from 'next/link'

type Props = { params: { id: string } }

export default async function Page({ params }: Props) {
  await requireAdminOrModerator()
  const { id } = params
  const res = await fetch(`/api/admin/regeneration-jobs/${id}`, { cache: 'no-store' })
  if (!res.ok) {
    return (<div style={{ padding: 24 }}><h1>Job not found</h1></div>)
  }
  const job = await res.json()

  return (
    <div style={{ padding: 24 }}>
      <h1 className="text-2xl font-bold mb-4">Regeneration Job {job.id}</h1>
      <div style={{ marginBottom: 12 }}>
        <strong>Status:</strong> {job.status}
      </div>
      <div style={{ marginBottom: 12 }}>
        <strong>Target:</strong> {job.targetType} / {job.targetId}
      </div>
      <div style={{ marginBottom: 12 }}>
        <strong>Created:</strong> {new Date(job.createdAt).toLocaleString()}
      </div>

      <div style={{ marginTop: 16 }}>
        <h2 className="text-lg font-semibold">Retry Controls</h2>
        <div style={{ marginTop: 8 }}>
          <CreateRetryIntent job={job} />
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href={`/admin/jobs/${job.id}/retry-intents`} className="text-blue-600 underline">View Retry Intents for this job</Link>
        </div>
      </div>
    </div>
  )
}
import React from 'react'
import { prisma } from '@/lib/prisma'
import TriggerJobButton from '../TriggerJobButton'
import ReadOnlyJsonViewer from '@/components/UI/ReadOnlyJsonViewer'
import Link from 'next/link'
import { requireAdminOrModerator } from '@/lib/auth'

type Props = { params: { id: string } }

export default async function JobDetail({ params }: Props) {
  await requireAdminOrModerator()
  const id = params.id
  const job = await prisma.regenerationJob.findUnique({ where: { id } })
  if (!job) {
    return <div style={{ padding: 20 }}>Job not found</div>
  }

  let output: any = null
  const outputRef = (job.outputRef as any) || null
  if (outputRef?.outputId) {
    output = await prisma.regenerationOutput.findUnique({ where: { id: outputRef.outputId } as any })
  }

  const allAudits = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } })
  const audits = allAudits.filter(a => {
    const raw: any = a
    if (raw.entityId === id) return true
    if (raw.details && (raw.details.suggestionId === job.suggestionId || raw.details.jobId === job.id)) return true
    return false
  })

  return (
    <div style={{ padding: 20 }}>
      <h1>Regeneration Job: {job.id}</h1>
      <p><strong>Status:</strong> {job.status}</p>
      <p><strong>Target:</strong> {job.targetType} / {job.targetId}</p>
      <p><strong>Created:</strong> {new Date(job.createdAt).toLocaleString()}</p>

      <h2>Instruction JSON</h2>
      <ReadOnlyJsonViewer data={job.instructionJson} />

      <h2>Output</h2>
      {output ? (
        <div>
          <ReadOnlyJsonViewer data={output.contentJson} />
          <p>Created at: {new Date(output.createdAt).toLocaleString()}</p>
        </div>
      ) : (
        <div>No output yet</div>
      )}

      {job.errorJson ? (
        <>
          <h2>Error</h2>
          <ReadOnlyJsonViewer data={job.errorJson} />
        </>
      ) : null}

      <h2>Actions</h2>
      {job.status === 'PENDING' ? (
        <TriggerJobButton jobId={job.id} />
      ) : (
        <div>No actions available for this status.</div>
      )}

      <h2>Audit Trail</h2>
      <ul>
        {audits.map(a => (
          <li key={a.id} style={{ marginBottom: 8 }}>
            <div><strong>{a.action}</strong> — {new Date(a.createdAt).toLocaleString()}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{JSON.stringify(a.details)}</div>
          </li>
        ))}
      </ul>

      <p><Link href="/admin/regeneration-jobs">Back to list</Link></p>
    </div>
  )
}
