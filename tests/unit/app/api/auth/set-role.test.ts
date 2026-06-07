/**
 * FILE OBJECTIVE:
 * - Verify POST /api/auth/set-role maps onboarding role selections to persisted Prisma roles and returns safe API responses.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/auth/set-role.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-05T00:00:00Z | copilot | added unit tests for set-role role mapping and error handling
 */

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    logAPI: jest.fn(),
    error: jest.fn(),
  },
}))

import { UserRole } from '@prisma/client'

import { POST } from '@/app/api/auth/set-role/route'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'

const mockGetServerSessionForHandlers = getServerSessionForHandlers as jest.Mock
const mockPrismaUserUpdate = prisma.user.update as jest.Mock
const mockPrismaUserFindUnique = prisma.user.findUnique as jest.Mock
const mockLoggerError = logger.error as jest.Mock

describe('POST /api/auth/set-role', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 when the request is unauthenticated', async () => {
    mockGetServerSessionForHandlers.mockResolvedValue(null)

    const request = new Request('http://localhost/api/auth/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'student' }),
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
    expect(mockPrismaUserUpdate).not.toHaveBeenCalled()
  })

  it('should persist the student selection as the Prisma user role', async () => {
    mockGetServerSessionForHandlers.mockResolvedValue({ user: { id: 'user-1' } })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'user', grade: null, board: null, accountStatus: 'active' })
    mockPrismaUserUpdate.mockResolvedValue({ id: 'user-1' })

    const request = new Request('http://localhost/api/auth/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'student' }),
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, role: 'student', redirect: '/student/onboarding' })
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: UserRole.user },
    })
  })

  it('should persist the parent selection as the Prisma parent role', async () => {
    mockGetServerSessionForHandlers.mockResolvedValue({ user: { id: 'user-2' } })
    mockPrismaUserFindUnique.mockResolvedValue({ role: 'user', grade: null, board: null, accountStatus: 'active' })
    mockPrismaUserUpdate.mockResolvedValue({ id: 'user-2' })

    const request = new Request('http://localhost/api/auth/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'parent' }),
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, role: 'parent', redirect: '/parent/onboarding' })
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { role: UserRole.parent },
    })
  })

  it('should return 400 when the requested role is invalid', async () => {
    mockGetServerSessionForHandlers.mockResolvedValue({ user: { id: 'user-3' } })

    const request = new Request('http://localhost/api/auth/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('role must be "student" or "parent"')
    expect(mockPrismaUserUpdate).not.toHaveBeenCalled()
  })

  it('should return 500 when persisting the role fails', async () => {
    mockGetServerSessionForHandlers.mockResolvedValue({ user: { id: 'user-4' } })
    mockPrismaUserUpdate.mockRejectedValue(new Error('db failed'))

    const request = new Request('http://localhost/api/auth/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'student' }),
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Internal server error')
    expect(mockLoggerError).toHaveBeenCalled()
  })
})
