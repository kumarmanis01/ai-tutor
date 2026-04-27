export type ApprovalStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED'

export interface ApprovalMetadata {
  status: ApprovalStatus
  approvedBy?: string
  approvedAt?: string
  approvalNote?: string
}

export default ApprovalMetadata
