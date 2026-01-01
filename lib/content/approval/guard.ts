import { ApprovalStatus } from './types'

export function assertEditable(status: ApprovalStatus) {
  if (status === 'APPROVED') {
    throw new Error('Approved content is immutable')
  }
}

export function assertPublishable(status: ApprovalStatus) {
  if (status !== 'APPROVED') {
    throw new Error('Only approved content can be published')
  }
}

export const approvalGuard = { assertEditable, assertPublishable }
export default approvalGuard
