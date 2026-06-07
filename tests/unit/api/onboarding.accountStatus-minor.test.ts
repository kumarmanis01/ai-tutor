/**
 * FILE OBJECTIVE:
 * - Unit tests for the under-13 onboarding account-status state machine in
 *   POST /api/user/onboarding (pending_parent_verification vs active).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/onboarding.accountStatus-minor.test.ts (self)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-06-07T00:00:00Z | claude | initial creation with standard header.
 *
 * Description:
 * Unit tests: under-13 onboarding account-status transitions in POST /api/user/onboarding
 *
 * - Minor + parent NOT verified -> accountStatus = pending_parent_verification, requiresOtp = true
 * - Minor + parent ALREADY verified (resubmit) -> accountStatus stays active, requiresOtp = false
 * - Adult -> accountStatus = active, requiresOtp = false
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() },
}))
jest.mock('@/lib/errorResponse', () => ({ formatErrorForResponse: (e: unknown) => String(e) }))
jest.mock('@/lib/dailyHabit', () => ({ getDailyTask: jest.fn().mockResolvedValue(null) }))
jest.mock('@/jobs/diagnosticBootstrap', () => ({ enqueueDiagnosticBootstrapJob: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }))
jest.mock('@/lib/auth', () => ({ invalidateUserSessionCache: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    subjectDef: { findMany: jest.fn().mockResolvedValue([{ name: 'math', slug: 'math' }]) },
    classLevel: { findFirst: jest.fn().mockResolvedValue(null) },
    event: { create: jest.fn().mockResolvedValue({}) },
    analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
  },
}))
jest.mock('@/lib/parent/contactLinking', () => ({
  ensureAutoLinkedParentsForStudent: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { POST } from '../../../app/api/user/onboarding/route'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const mockSession = (getServerSessionForHandlers as jest.Mock)
const mockFindUnique = (prisma.user.findUnique as jest.Mock)
const mockUpdate = (prisma.user.update as jest.Mock)

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/user/onboarding', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const MINOR_BODY = {
  name: 'Kid Student',
  age: 8,
  class_grade: '3',
  board: 'CBSE',
  preferred_language: 'en',
  subjects: ['math'],
  parent_email: 'parent@example.com',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.mockResolvedValue({ user: { id: 'user-1', email: 'kid@example.com' } })
})

/**
 * Helper: stage the sequence of findUnique calls the onboarding route makes.
 * The 3rd findUnique (after the user.update + setAccountStatus) is the
 * verification-state read used to derive accountStatus and requiresOtp.
 */
function stageFindUnique({
  existing,
  parentEmailVerifiedAt,
  parentWhatsappVerifiedAt,
}: {
  existing: Record<string, unknown> | null
  parentEmailVerifiedAt: Date | null
  parentWhatsappVerifiedAt: Date | null
}) {
  mockFindUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
    if (args?.select?.parentEmailVerifiedAt) {
      return { parentEmailVerifiedAt, parentWhatsappVerifiedAt }
    }
    return existing
  })
}

describe('POST /api/user/onboarding -- accountStatus transitions for minors', () => {
  test('minor + parent NOT verified -> pending_parent_verification + requiresOtp=true', async () => {
    stageFindUnique({
      existing: { id: 'user-1', age: null, grade: null, name: null, board: null },
      parentEmailVerifiedAt: null,
      parentWhatsappVerifiedAt: null,
    })
    mockUpdate.mockResolvedValue({
      id: 'user-1', name: 'Kid Student', phone: null, age: 8,
      parentEmail: 'parent@example.com', language: 'en',
    })

    const res = await POST(makeReq(MINOR_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.requiresOtp).toBe(true)

    // The 2nd update call is the accountStatus write.
    const statusUpdate = mockUpdate.mock.calls.find(
      (c) => c[0]?.data?.accountStatus !== undefined,
    )
    expect(statusUpdate).toBeDefined()
    expect(statusUpdate![0].data.accountStatus).toBe('pending_parent_verification')
  })

  test('minor + parentEmailVerified -> stays active on resubmit, requiresOtp=false', async () => {
    stageFindUnique({
      existing: {
        id: 'user-1', age: 8, grade: '3', name: 'Kid Student', board: 'CBSE',
        parentEmail: 'parent@example.com', language: 'en',
      },
      parentEmailVerifiedAt: new Date(),
      parentWhatsappVerifiedAt: null,
    })
    mockUpdate.mockResolvedValue({
      id: 'user-1', name: 'Kid Student', phone: null, age: 8,
      parentEmail: 'parent@example.com', language: 'en',
    })

    const res = await POST(makeReq(MINOR_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.requiresOtp).toBe(false)

    const statusUpdate = mockUpdate.mock.calls.find(
      (c) => c[0]?.data?.accountStatus !== undefined,
    )
    expect(statusUpdate).toBeDefined()
    expect(statusUpdate![0].data.accountStatus).toBe('active')
  })

  test('minor + parentWhatsappVerified -> stays active on resubmit, requiresOtp=false', async () => {
    stageFindUnique({
      existing: {
        id: 'user-1', age: 8, grade: '3', name: 'Kid Student', board: 'CBSE',
        parentEmail: 'parent@example.com', language: 'en',
      },
      parentEmailVerifiedAt: null,
      parentWhatsappVerifiedAt: new Date(),
    })
    mockUpdate.mockResolvedValue({
      id: 'user-1', name: 'Kid Student', phone: null, age: 8,
      parentEmail: 'parent@example.com', language: 'en',
    })

    const res = await POST(makeReq(MINOR_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.requiresOtp).toBe(false)

    const statusUpdate = mockUpdate.mock.calls.find(
      (c) => c[0]?.data?.accountStatus !== undefined,
    )
    expect(statusUpdate![0].data.accountStatus).toBe('active')
  })

  test('adult -> active + requiresOtp=false', async () => {
    stageFindUnique({
      existing: { id: 'user-1', age: null, grade: null, name: null, board: null },
      parentEmailVerifiedAt: null,
      parentWhatsappVerifiedAt: null,
    })
    mockUpdate.mockResolvedValue({
      id: 'user-1', name: 'Adult Student', phone: null, age: 25,
      parentEmail: null, language: 'en',
    })

    const res = await POST(makeReq({ ...MINOR_BODY, age: 25, class_grade: '12', parent_email: undefined }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.requiresOtp).toBe(false)

    const statusUpdate = mockUpdate.mock.calls.find(
      (c) => c[0]?.data?.accountStatus !== undefined,
    )
    expect(statusUpdate![0].data.accountStatus).toBe('active')
  })
})
