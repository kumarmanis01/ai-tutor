import React from 'react'
import { requireAdminOrModerator } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
import ReadOnlyJsonViewer from '@/components/UI/ReadOnlyJsonViewer'
import ApproveRejectButtonsClient from '@/components/ClientOnly/ApproveRejectButtonsClient'

type Props = { params: { id: string } }

export default async function PromotionDetail({ params }: Props) {
  await requireAdminOrModerator()
  const id = params.id
  const candidate = await prisma.promotionCandidate.findUnique({ where: { id } })
  if (!candidate) return <div style={{ padding: 20 }}>Candidate not found</div>

  return (
    <div style={{ padding: 20 }}>
      <h1 className="text-2xl font-bold mb-4">Promotion Candidate {candidate.id}</h1>
      <div style={{ marginBottom: 8 }}><strong>Scope:</strong> {candidate.scope} / {candidate.scopeRefId}</div>
      <div style={{ marginBottom: 8 }}><strong>Status:</strong> {candidate.status}</div>
      <div style={{ marginBottom: 8 }}><strong>Job:</strong> {candidate.regenerationJobId}</div>

      <h2 className="mt-4">Output Reference</h2>
      <ReadOnlyJsonViewer data={candidate.outputRef} collapsedByDefault={false} />

      <div className="mt-4">
        <ApproveRejectButtonsClient candidate={candidate} />
      </div>
    </div>
  )
}
