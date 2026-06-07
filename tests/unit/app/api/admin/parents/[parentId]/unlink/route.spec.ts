/**
 * FILE OBJECTIVE:
 * - Unit tests for DELETE /api/admin/parents/[parentId]/unlink.
 *   Covers: auth guard, missing studentId param, link-not-found 404,
 *   happy path (unlinks + audit log), and DB error handling.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/parents/[parentId]/unlink/route.spec.ts (this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-07 | claude | created
 */

describe('DELETE /api/admin/parents/[parentId]/unlink', () => {
  const PARENT_ID = 'parent-1'
  const STUDENT_ID = 'student-1'
  const LINK_ID = 'link-1'
  const ADMIN_ID = 'admin-1'

  function makeRequest(studentId?: string) {
    const url = studentId
      ? `http://localhost/api/admin/parents/${PARENT_ID}/unlink?studentId=${studentId}`
      : `http://localhost/api/admin/parents/${PARENT_ID}/unlink`
    return new Request(url, { method: 'DELETE' })
  }

  function makeContext(parentId = PARENT_ID) {
    return { params: Promise.resolve({ parentId }) }
  }

  function buildMocks(opts: {
    adminRole?: string
    linkExists?: boolean
    transactionFails?: boolean
  } = {}) {
    const { adminRole = 'admin', linkExists = true, transactionFails = false } = opts

    const findUnique = jest.fn().mockResolvedValue(linkExists ? { id: LINK_ID } : null)
    const parentStudentDelete = jest.fn().mockResolvedValue({ id: LINK_ID })
    const auditLogCreate = jest.fn().mockResolvedValue({ id: 'audit-1' })
    const transaction = transactionFails
      ? jest.fn().mockRejectedValue(new Error('DB error'))
      : jest.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops))

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue({
        user: { id: ADMIN_ID, role: adminRole },
      }),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        parentStudent: { findUnique, delete: parentStudentDelete },
        auditLog: { create: auditLogCreate },
        $transaction: transaction,
      },
    }))
    jest.doMock('@/utils/logApiUsage', () => ({ logApiUsage: jest.fn() }))

    return { findUnique, parentStudentDelete, auditLogCreate, transaction }
  }

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('should return 403 when session is missing', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn().mockResolvedValue(null),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: {} }))
    jest.doMock('@/utils/logApiUsage', () => ({ logApiUsage: jest.fn() }))

    const { DELETE } = await import('@/app/api/admin/parents/[parentId]/unlink/route')
    const res = await DELETE(makeRequest(STUDENT_ID), makeContext())
    expect(res.status).toBe(403)
  })

  it('should return 403 when caller is not admin', async () => {
    buildMocks({ adminRole: 'user' })
    const { DELETE } = await import('@/app/api/admin/parents/[parentId]/unlink/route')
    const res = await DELETE(makeRequest(STUDENT_ID), makeContext())
    expect(res.status).toBe(403)
  })

  it('should return 400 when studentId param is missing', async () => {
    buildMocks()
    const { DELETE } = await import('@/app/api/admin/parents/[parentId]/unlink/route')
    const res = await DELETE(makeRequest(), makeContext())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('studentId_required')
  })

  it('should return 404 when link does not exist', async () => {
    buildMocks({ linkExists: false })
    const { DELETE } = await import('@/app/api/admin/parents/[parentId]/unlink/route')
    const res = await DELETE(makeRequest(STUDENT_ID), makeContext())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('link_not_found')
  })

  it('should unlink and create audit log on happy path', async () => {
    const { findUnique, transaction } = buildMocks()
    const { DELETE } = await import('@/app/api/admin/parents/[parentId]/unlink/route')
    const res = await DELETE(makeRequest(STUDENT_ID), makeContext())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    expect(findUnique).toHaveBeenCalledWith({
      where: { parentId_studentId: { parentId: PARENT_ID, studentId: STUDENT_ID } },
      select: { id: true },
    })
    expect(transaction).toHaveBeenCalled()
  })

  it('should return 500 when DB transaction fails', async () => {
    buildMocks({ transactionFails: true })
    const { DELETE } = await import('@/app/api/admin/parents/[parentId]/unlink/route')
    const res = await DELETE(makeRequest(STUDENT_ID), makeContext())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('failed')
  })
})
