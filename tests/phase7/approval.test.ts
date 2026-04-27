import { approveContent, archiveContent, getApprovalMetadata, resetApprovalStore } from '@/lib/content/approval/service'
import { approvalAuditLogs, clearAuditLogs } from '@/lib/content/approval/audit'
import { assertEditable, assertPublishable } from '@/lib/content/approval/guard'
import { ensureLessonEditable } from '@/lib/content/lesson/generator'

beforeEach(() => {
  resetApprovalStore()
  clearAuditLogs()
})

test('approving sets approvedBy and approvedAt and logs audit', () => {
  const meta = approveContent({ contentId: 'c1', approver: 'alice', note: 'LGTM' })
  expect(meta.status).toBe('APPROVED')
  expect(meta.approvedBy).toBe('alice')
  expect(meta.approvedAt).toBeDefined()
  expect(approvalAuditLogs.length).toBe(1)
  expect(approvalAuditLogs[0].action).toBe('APPROVED')
})

test('editing after approval throws via guard', () => {
  approveContent({ contentId: 'c2', approver: 'bob' })
  const meta = getApprovalMetadata('c2')
  expect(() => assertEditable(meta!.status)).toThrow(/immutable/i)
  // generator helper should also enforce
  expect(() => ensureLessonEditable(meta)).toThrow(/immutable/i)
})

test('publishing without approval throws', () => {
  expect(() => assertPublishable('DRAFT')).toThrow(/Only approved/i)
})

test('archive works only after approval', () => {
  expect(() => archiveContent({ contentId: 'c3', by: 'admin' })).toThrow()
  approveContent({ contentId: 'c3', approver: 'admin' })
  const archived = archiveContent({ contentId: 'c3', by: 'admin' })
  expect(archived.status).toBe('ARCHIVED')
  expect(approvalAuditLogs.find((a) => a.action === 'ARCHIVED')).toBeDefined()
})
