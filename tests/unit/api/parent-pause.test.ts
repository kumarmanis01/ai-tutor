/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() } }));
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'
import '../../helpers/mockSession'

describe('Parent pause API', () => {
  beforeEach(() => {
    resetPrismaMock()
    ;(global as any).__TEST_SESSION__ = { user: { id: 'parent-1', role: 'parent', email: 'parent@example.test' } }
  })

  it('POST pause updates ParentStudent and returns ok', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue({ id: 'link-1', status: 'active' })
    prismaMock.parentStudent.update.mockResolvedValue({ id: 'link-1', isPaused: true, pausedUntil: new Date('2026-05-01T00:00:00.000Z') })

    const { POST } = await import('@/app/api/parent/pause/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ studentId: 'student-1', action: 'pause', pausedUntil: '2026-05-01T00:00:00.000Z', pauseReason: 'vacation' }), headers: { 'Content-Type': 'application/json' } })
    const response = await POST(req as any) as any
    const data = await response.json()

    expect(data.ok).toBe(true)
    expect(prismaMock.parentStudent.update).toHaveBeenCalled()
  })

  it('POST returns 401 when not authenticated', async () => {
    ;(global as any).__TEST_SESSION__ = null
    const { POST } = await import('@/app/api/parent/pause/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ studentId: 'student-1', action: 'pause' }), headers: { 'Content-Type': 'application/json' } })
    const response = await POST(req as any) as any
    expect(response.status).toBe(401)
  })
})
