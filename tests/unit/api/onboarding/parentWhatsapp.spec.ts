/**
 * FILE OBJECTIVE:
 * - Unit tests for parent_whatsapp field in POST /api/user/onboarding.
 * - Covers: mapping to User.parentPhone, digit validation, and the
 *   under-DPDP_MINOR_AGE server-side gate that requires at least one
 *   valid parent contact before allowing accountStatus to be set.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/onboarding/parentWhatsapp.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-06 | claude | created for parent_whatsapp review fixes
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() },
}))
jest.mock('@/lib/errorResponse', () => ({ formatErrorForResponse: (e: unknown) => String(e) }))
jest.mock('@/lib/dailyHabit', () => ({ getDailyTask: jest.fn().mockResolvedValue(null) }))
jest.mock('@/jobs/diagnosticBootstrap', () => ({ enqueueDiagnosticBootstrapJob: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/session', () => ({ getServerSessionForHandlers: jest.fn() }))
jest.mock('@/lib/diagnostics/enqueueSubjectHydration', () => ({ enqueueSubjectHydration: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/ai/learningPlan', () => ({ generateLearningPlan: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/mailer', () => ({ sendMailSafe: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/email/templates', () => ({ welcomeEmailHtml: jest.fn().mockReturnValue('<html/>') }))
jest.mock('@prisma/client', () => ({ LanguageCode: { en: 'en', hi: 'hi' } }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    subjectDef: { findMany: jest.fn() },
    classLevel: { findFirst: jest.fn() },
    event: { create: jest.fn() },
    analyticsEvent: { create: jest.fn() },
    learningPlan: { findMany: jest.fn() },
  },
}))

import { NextRequest } from 'next/server'
import { POST } from '../../../../app/api/user/onboarding/route'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const mockSession = getServerSessionForHandlers as jest.Mock
const mockFindUnique = prisma.user.findUnique as jest.Mock
const mockUpdate = prisma.user.update as jest.Mock

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/user/onboarding', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const BASE_BODY = {
  name: 'Test Student',
  age: 16,
  class_grade: '10',
  board: 'cbse',
  preferred_language: 'en',
  subjects: ['math'],
}

const MINOR_BODY = {
  ...BASE_BODY,
  age: 11,
  parent_email: 'parent@example.com',
}

const EXISTING_USER = { id: 'user-1', grade: null, whatsappPhone: null, parentPhone: null, phone: null, name: null }
const UPDATED_USER = { id: 'user-1', name: 'Test Student', phone: null, email: 'student@example.com', welcomeEmailSent: true }

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.subjectDef.findMany as jest.Mock).mockResolvedValue([{ name: 'math', slug: 'math' }])
  ;(prisma.classLevel.findFirst as jest.Mock).mockResolvedValue(null)
  ;(prisma.event.create as jest.Mock).mockResolvedValue({})
  ;(prisma.analyticsEvent.create as jest.Mock).mockResolvedValue({})
  ;(prisma.learningPlan.findMany as jest.Mock).mockResolvedValue([])
  mockFindUnique.mockResolvedValue(EXISTING_USER)
  mockUpdate.mockResolvedValue(UPDATED_USER)
})

describe('POST /api/user/onboarding -- parent_whatsapp field', () => {
  test('should store valid parent_whatsapp to User.parentPhone', async () => {
    const res = await POST(makeReq({ ...BASE_BODY, parent_whatsapp: '+919876543210' }))
    expect(res.status).toBe(200)

    const updateCall = mockUpdate.mock.calls[0][0]
    expect(updateCall.data.parentPhone).toBe('+919876543210')
  })

  test('should normalise parent_whatsapp by stripping non-digit/plus chars before storing', async () => {
    const res = await POST(makeReq({ ...BASE_BODY, parent_whatsapp: '98765-43210' }))
    expect(res.status).toBe(200)

    const updateCall = mockUpdate.mock.calls[0][0]
    expect(updateCall.data.parentPhone).toBe('9876543210')
  })

  test('should return 400 when parent_whatsapp is provided but has fewer than 10 digits', async () => {
    const res = await POST(makeReq({ ...BASE_BODY, parent_whatsapp: '+91123' }))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('validation_error')
    expect(body.fieldErrors.parent_whatsapp).toBeDefined()
  })

  test('should return 400 when parent_whatsapp is only "+" with no digits', async () => {
    const res = await POST(makeReq({ ...BASE_BODY, parent_whatsapp: '+' }))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.fieldErrors.parent_whatsapp).toBeDefined()
  })

  test('should not set parentPhone when parent_whatsapp is absent', async () => {
    const res = await POST(makeReq(BASE_BODY))
    expect(res.status).toBe(200)

    const updateCall = mockUpdate.mock.calls[0][0]
    expect(updateCall.data).not.toHaveProperty('parentPhone')
  })
})

describe('POST /api/user/onboarding -- under-DPDP age gate (server-side)', () => {
  test('should return 400 for under-13 student with no parent contact at all', async () => {
    const res = await POST(makeReq({ ...BASE_BODY, age: 11 }))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('validation_error')
    expect(body.fieldErrors.parentContact).toBeDefined()
  })

  test('should accept under-13 student when valid parent_email is provided', async () => {
    const res = await POST(makeReq(MINOR_BODY))
    expect(res.status).toBe(200)
  })

  test('should accept under-13 student when valid parent_whatsapp is provided', async () => {
    const res = await POST(makeReq({ ...BASE_BODY, age: 11, parent_whatsapp: '+919876543210' }))
    expect(res.status).toBe(200)
  })

  test('should accept under-13 student when both parent_email and parent_whatsapp are provided', async () => {
    const res = await POST(makeReq({
      ...BASE_BODY,
      age: 11,
      parent_email: 'p@example.com',
      parent_whatsapp: '+919876543210',
    }))
    expect(res.status).toBe(200)
  })

  test('should not require parent contact for student at or above DPDP_MINOR_AGE', async () => {
    const res = await POST(makeReq({ ...BASE_BODY, age: 13 }))
    expect(res.status).toBe(200)
  })
})
