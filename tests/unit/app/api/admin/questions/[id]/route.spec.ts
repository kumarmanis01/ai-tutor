/**
 * FILE OBJECTIVE:
 * - Unit tests for PATCH /api/admin/questions/[id] moderation actions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/questions/[id]/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add coverage for approve/reject audit trails and manual force-validate guard
 */

describe('PATCH /api/admin/questions/[id]', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('updates status and records the previous and next moderation states', async () => {
    const questionFindUnique = jest.fn().mockResolvedValue({ id: 'question-1', source: 'manual', status: 'PENDING_REVIEW' })
    const questionUpdate = jest.fn().mockResolvedValue({ id: 'question-1' })
    const auditLogCreate = jest.fn()
    const transaction = jest.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[]))

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'admin-1', role: 'admin' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        question: {
          findUnique: questionFindUnique,
          update: questionUpdate,
        },
        auditLog: {
          create: auditLogCreate,
        },
        $transaction: transaction,
      },
    }))
    jest.doMock('@prisma/client', () => ({
      QuestionStatus: {
        ACTIVE: 'ACTIVE',
        REJECTED: 'REJECTED',
      },
      AdminActionType: {
        QUESTION_APPROVE: 'QUESTION_APPROVE',
        QUESTION_REJECT: 'QUESTION_REJECT',
      },
    }))

    const { PATCH } = await import('@/app/api/admin/questions/[id]/route')
    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACTIVE' }),
      }) as any,
      { params: Promise.resolve({ id: 'question-1' }) },
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ACTIVE')
    expect(questionUpdate).toHaveBeenCalledWith({ where: { id: 'question-1' }, data: { status: 'ACTIVE' } })
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'QUESTION_APPROVE',
          details: {
            previousStatus: 'PENDING_REVIEW',
            nextStatus: 'ACTIVE',
          },
        }),
      }),
    )
  })

  it('allows force-validation for manually authored questions only', async () => {
    const questionFindUnique = jest.fn().mockResolvedValue({ id: 'question-2', source: 'manual', status: 'ACTIVE' })
    const questionUpdate = jest.fn().mockResolvedValue({ id: 'question-2' })
    const auditLogCreate = jest.fn()
    const transaction = jest.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[]))

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'admin-1', role: 'admin' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        question: {
          findUnique: questionFindUnique,
          update: questionUpdate,
        },
        auditLog: {
          create: auditLogCreate,
        },
        $transaction: transaction,
      },
    }))
    jest.doMock('@prisma/client', () => ({
      QuestionStatus: {
        ACTIVE: 'ACTIVE',
        REJECTED: 'REJECTED',
      },
      AdminActionType: {
        QUESTION_APPROVE: 'QUESTION_APPROVE',
        QUESTION_REJECT: 'QUESTION_REJECT',
      },
    }))

    const { PATCH } = await import('@/app/api/admin/questions/[id]/route')
    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ validated: true }),
      }) as any,
      { params: Promise.resolve({ id: 'question-2' }) },
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.validated).toBe(true)
    expect(questionUpdate).toHaveBeenCalledWith({
      where: { id: 'question-2' },
      data: expect.objectContaining({ validated: true }),
    })
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'QUESTION_APPROVE',
          newValue: expect.objectContaining({ validated: true }),
        }),
      }),
    )
  })

  it('rejects force-validation for non-manual questions', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'admin-1', role: 'admin' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        question: {
          findUnique: jest.fn().mockResolvedValue({ id: 'question-3', source: 'ai', status: 'ACTIVE' }),
          update: jest.fn(),
        },
        auditLog: {
          create: jest.fn(),
        },
        $transaction: jest.fn(),
      },
    }))
    jest.doMock('@prisma/client', () => ({
      QuestionStatus: {
        ACTIVE: 'ACTIVE',
        REJECTED: 'REJECTED',
      },
      AdminActionType: {
        QUESTION_APPROVE: 'QUESTION_APPROVE',
        QUESTION_REJECT: 'QUESTION_REJECT',
      },
    }))

    const { PATCH } = await import('@/app/api/admin/questions/[id]/route')
    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ validated: true }),
      }) as any,
      { params: Promise.resolve({ id: 'question-3' }) },
    )

    expect(response.status).toBe(422)
  })
})