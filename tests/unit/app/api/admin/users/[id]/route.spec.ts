/**
 * FILE OBJECTIVE:
 * - Unit tests for admin user delete handler with FK-safe cleanup ordering.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/users/[id]/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T19:00:00Z | copilot | add regression tests for FK-safe user deletion and generic error response
 */

describe('DELETE /api/admin/users/[id]', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  function createPrismaMocks(shouldFailDelete = false) {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 })
    const updateMany = jest.fn().mockResolvedValue({ count: 1 })
    const userDelete = shouldFailDelete
      ? jest.fn().mockRejectedValue(new Error('Foreign key constraint failed'))
      : jest.fn().mockResolvedValue({ id: 'student-1' })

    const prismaMock = {
      room: { updateMany },
      auditLog: { updateMany, create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      approvalAudit: { updateMany },
      phoneOtp: { deleteMany },
      trial: { deleteMany },
      chatHistory: { deleteMany },
      chat: { deleteMany },
      event: { deleteMany },
      payment: { deleteMany },
      contentRecommendation: { deleteMany },
      apiUsage: { deleteMany },
      generatedStudyContent: { deleteMany },
      studentStudyBookmark: { deleteMany },
      doubtEscalation: { deleteMany },
      sessionQuestionFlag: { deleteMany },
      diagnosticSession: { deleteMany },
      mockExamSectionAttempt: { deleteMany },
      mockExamAttempt: { deleteMany },
      referralReward: { deleteMany },
      referral: { deleteMany },
      deletionRequest: { deleteMany },
      user: { delete: userDelete },
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    }

    return { prismaMock, userDelete }
  }

  it('cleans non-cascade dependencies and deletes the user', async () => {
    const { prismaMock } = createPrismaMocks()
    const loggerError = jest.fn()

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'admin-1', role: 'admin' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/utils/logApiUsage', () => ({ logApiUsage: jest.fn() }))
    jest.doMock('@/lib/auth', () => ({ invalidateUserSessionCache: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { error: loggerError } }))
    jest.doMock('@prisma/client', () => ({
      AdminActionType: { ERASURE_PURGE: 'ERASURE_PURGE', GRADE_CHANGE: 'GRADE_CHANGE' },
    }))

    const { DELETE } = await import('@/app/api/admin/users/[id]/route')
    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }) as any, {
      params: Promise.resolve({ id: 'student-1' }),
    })

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, user: { id: 'student-1' } })
    expect(prismaMock.diagnosticSession.deleteMany).toHaveBeenCalledWith({ where: { studentId: 'student-1' } })
    expect(prismaMock.mockExamSectionAttempt.deleteMany).toHaveBeenCalledWith({
      where: { attempt: { studentId: 'student-1' } },
    })
    expect(prismaMock.mockExamAttempt.deleteMany).toHaveBeenCalledWith({ where: { studentId: 'student-1' } })
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'student-1' } })
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adminId: 'admin-1', action: 'ERASURE_PURGE' }),
      }),
    )
    expect(loggerError).not.toHaveBeenCalled()
  })

  it('nulls adminId in audit log when admin deletes their own account', async () => {
    const { prismaMock } = createPrismaMocks()

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'admin-1', role: 'admin' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/utils/logApiUsage', () => ({ logApiUsage: jest.fn() }))
    jest.doMock('@/lib/auth', () => ({ invalidateUserSessionCache: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
    jest.doMock('@prisma/client', () => ({
      AdminActionType: { ERASURE_PURGE: 'ERASURE_PURGE', GRADE_CHANGE: 'GRADE_CHANGE' },
    }))

    const { DELETE } = await import('@/app/api/admin/users/[id]/route')
    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }) as any, {
      params: Promise.resolve({ id: 'admin-1' }),
    })

    expect(response.status).toBe(200)
    expect(prismaMock.auditLog.updateMany).toHaveBeenCalledWith({
      where: { adminId: 'admin-1' },
      data: { adminId: null },
    })
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adminId: null }),
      }),
    )
  })

  it('returns a generic error response when user deletion fails', async () => {
    const { prismaMock } = createPrismaMocks(true)
    const loggerError = jest.fn()

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'admin-1', role: 'admin' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({ prisma: prismaMock }))
    jest.doMock('@/utils/logApiUsage', () => ({ logApiUsage: jest.fn() }))
    jest.doMock('@/lib/auth', () => ({ invalidateUserSessionCache: jest.fn() }))
    jest.doMock('@/lib/logger', () => ({ logger: { error: loggerError } }))
    jest.doMock('@prisma/client', () => ({
      AdminActionType: { ERASURE_PURGE: 'ERASURE_PURGE', GRADE_CHANGE: 'GRADE_CHANGE' },
    }))

    const { DELETE } = await import('@/app/api/admin/users/[id]/route')
    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }) as any, {
      params: Promise.resolve({ id: 'student-1' }),
    })

    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'delete_failed', message: 'Failed to delete user' })
    expect(loggerError).toHaveBeenCalledWith(
      'admin.users.delete.failed',
      expect.objectContaining({
        context: expect.objectContaining({ targetUserId: 'student-1' }),
      }),
    )
  })
})
