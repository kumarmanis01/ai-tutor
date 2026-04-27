export interface ApprovalAuditLog {
  contentId: string
  action: 'APPROVED' | 'ARCHIVED'
  by: string
  at: string
  note?: string
}

export const approvalAuditLogs: ApprovalAuditLog[] = []

export function addAuditLog(log: ApprovalAuditLog) {
  approvalAuditLogs.push(log)
}

export function clearAuditLogs() {
  approvalAuditLogs.length = 0
}

export const audit = { approvalAuditLogs, addAuditLog, clearAuditLogs }
export default audit
