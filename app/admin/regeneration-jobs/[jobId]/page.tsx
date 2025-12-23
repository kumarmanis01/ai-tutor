import React from 'react'
import { requireAdminOrModerator } from '@/lib/auth'
import CreateRetryIntent from '@/app/admin/regeneration-jobs/CreateRetryIntent'
import Link from 'next/link'

type Props = { params: { jobId: string } }

export default async function Page({ params }: Props) {
  await requireAdminOrModerator()
  const { jobId } = params
  const res = await fetch(`/api/admin/regeneration-jobs/${jobId}`, { cache: 'no-store' })
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
