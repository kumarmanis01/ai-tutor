/**
 * FILE OBJECTIVE:
 * - Unit tests for POST /api/student/question/[questionId]/flag route behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/question/[questionId]/flag/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-13T00:00:00Z | copilot | add coverage for immediate review routing, quarantine escalation, and invalid reason handling
 */

describe('POST /api/student/question/[questionId]/flag', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('moves an active question into pending review on the first valid flag', async () => {
    const transaction = jest.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[]))
    const questionUpdate = jest.fn().mockResolvedValue({ id: 'question-1', status: 'PENDING_REVIEW' })
    const auditLogCreate = jest.fn()
    const questionFindUnique = jest.fn().mockResolvedValue({ id: 'question-1', status: 'ACTIVE' })
    const flagUpsert = jest.fn().mockResolvedValue({ id: 'flag-1' })
    const flagCount = jest.fn().mockResolvedValue(1)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'student-1' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        question: {
          findUnique: questionFindUnique,
          update: questionUpdate,
        },
        sessionQuestionFlag: {
          upsert: flagUpsert,
          count: flagCount,
        },
        auditLog: {
          create: auditLogCreate,
        },
        $transaction: transaction,
      },
    }))
    jest.doMock('@prisma/client', () => ({
      FlagReason: {
        WRONG_ANSWER: 'WRONG_ANSWER',
        OFF_TOPIC: 'OFF_TOPIC',
      },
      QuestionStatus: {
        ACTIVE: 'ACTIVE',
        PENDING_REVIEW: 'PENDING_REVIEW',
        QUARANTINED: 'QUARANTINED',
      },
      AdminActionType: {
        QUESTION_QUARANTINE: 'QUESTION_QUARANTINE',
      },
    }))

    const { POST } = await import('@/app/api/student/question/[questionId]/flag/route')
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ reason: 'INCORRECT' }),
      }) as any,
      { params: Promise.resolve({ questionId: 'question-1' }) },
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.flagged).toBe(true)
    expect(body.totalFlags).toBe(1)
    expect(body.reviewStatus).toBe('PENDING_REVIEW')
    expect(body.reasonLabel).toBe('Incorrect')
    expect(flagUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { questionId_studentId: { questionId: 'question-1', studentId: 'student-1' } },
        create: expect.objectContaining({ reason: 'WRONG_ANSWER' }),
        update: expect.objectContaining({ reason: 'WRONG_ANSWER' }),
      }),
    )
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(questionUpdate).toHaveBeenCalledWith({
      where: { id: 'question-1' },
      data: { status: 'PENDING_REVIEW' },
    })
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'QUESTION_QUARANTINE',
          details: expect.objectContaining({
            previousStatus: 'ACTIVE',
            nextStatus: 'PENDING_REVIEW',
            selectedReason: 'Incorrect',
          }),
        }),
      }),
    )
  })

  it('escalates a pending review question to quarantined at the threshold', async () => {
    const transaction = jest.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[]))
    const questionUpdate = jest.fn().mockResolvedValue({ id: 'question-2', status: 'QUARANTINED' })
    const auditLogCreate = jest.fn()
    const questionFindUnique = jest.fn().mockResolvedValue({ id: 'question-2', status: 'PENDING_REVIEW' })
    const flagUpsert = jest.fn().mockResolvedValue({ id: 'flag-2' })
    const flagCount = jest.fn().mockResolvedValue(3)

    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'student-2' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        question: {
          findUnique: questionFindUnique,
          update: questionUpdate,
        },
        sessionQuestionFlag: {
          upsert: flagUpsert,
          count: flagCount,
        },
        auditLog: {
          create: auditLogCreate,
        },
        $transaction: transaction,
      },
    }))
    jest.doMock('@prisma/client', () => ({
      FlagReason: {
        WRONG_ANSWER: 'WRONG_ANSWER',
        OFF_TOPIC: 'OFF_TOPIC',
      },
      QuestionStatus: {
        ACTIVE: 'ACTIVE',
        PENDING_REVIEW: 'PENDING_REVIEW',
        QUARANTINED: 'QUARANTINED',
      },
      AdminActionType: {
        QUESTION_QUARANTINE: 'QUESTION_QUARANTINE',
      },
    }))

    const { POST } = await import('@/app/api/student/question/[questionId]/flag/route')
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ reason: 'WRONG_ANSWER' }),
      }) as any,
      { params: Promise.resolve({ questionId: 'question-2' }) },
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.reviewStatus).toBe('QUARANTINED')
    expect(flagCount).toHaveBeenCalledWith({ where: { questionId: 'question-2' } })
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(questionUpdate).toHaveBeenCalledWith({
      where: { id: 'question-2' },
      data: { status: 'QUARANTINED' },
    })
  })

  it('rejects an unsupported flag reason', async () => {
    jest.doMock('@/lib/session', () => ({
      getServerSessionForHandlers: jest.fn(async () => ({ user: { id: 'student-3' } })),
    }))
    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        question: { findUnique: jest.fn() },
        sessionQuestionFlag: { upsert: jest.fn(), count: jest.fn() },
        auditLog: { create: jest.fn() },
        $transaction: jest.fn(),
      },
    }))
    jest.doMock('@prisma/client', () => ({
      FlagReason: {
        WRONG_ANSWER: 'WRONG_ANSWER',
        OFF_TOPIC: 'OFF_TOPIC',
      },
      QuestionStatus: {
        ACTIVE: 'ACTIVE',
        PENDING_REVIEW: 'PENDING_REVIEW',
        QUARANTINED: 'QUARANTINED',
      },
      AdminActionType: {
        QUESTION_QUARANTINE: 'QUESTION_QUARANTINE',
      },
    }))

    const { POST } = await import('@/app/api/student/question/[questionId]/flag/route')
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ reason: 'NOT_VALID' }),
      }) as any,
      { params: Promise.resolve({ questionId: 'question-3' }) },
    )

    expect(response.status).toBe(400)
  })
})