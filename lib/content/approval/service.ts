import { ApprovalMetadata } from './types'
import { addAuditLog } from './audit'

const store = new Map<string, ApprovalMetadata>()

export function getApprovalMetadata(contentId: string): ApprovalMetadata | undefined {
  return store.get(contentId)
}

export function resetApprovalStore() {
  store.clear()
}

export function approveContent({ contentId, approver, note }: { contentId: string; approver: string; note?: string }): ApprovalMetadata {
  const now = new Date().toISOString()
  const meta: ApprovalMetadata = {
    status: 'APPROVED',
    approvedBy: approver,
    approvedAt: now,
    approvalNote: note
  }
  store.set(contentId, meta)
  addAuditLog({ contentId, action: 'APPROVED', by: approver, at: now, note })
  return meta
}

export function archiveContent({ contentId, by }: { contentId: string; by: string }): ApprovalMetadata {
  const existing = store.get(contentId)
  if (!existing || existing.status !== 'APPROVED') {
    throw new Error('Can only archive approved content')
  }
  const now = new Date().toISOString()
  const updated: ApprovalMetadata = { ...existing, status: 'ARCHIVED' }
  store.set(contentId, updated)
  addAuditLog({ contentId, action: 'ARCHIVED', by, at: now })
  return updated
}

export const approvalService = { getApprovalMetadata, approveContent, archiveContent, resetApprovalStore }
export default approvalService
