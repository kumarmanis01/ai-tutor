/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'
import '../../helpers/mockSession'

describe('Parent set exam-date API', () => {
  beforeEach(() => {
    resetPrismaMock()
    ;(global as any).__TEST_SESSION__ = { user: { id: 'parent-1', role: 'parent', email: 'parent@example.test' } }
  })

  it('returns 403 when parent not linked to student', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue(null)
    const { POST } = await import('@/app/api/parent/exam-date/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ studentId: 'student-1', examDate: '2026-05-01' }), headers: { 'Content-Type': 'application/json' } })
    const res = await POST(req as any) as any
    expect(res.status).toBe(403)
  })

  it('updates examDate when linked', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue({ id: 'link-1', status: 'active' })
    prismaMock.user.update.mockResolvedValue({})
    const { POST } = await import('@/app/api/parent/exam-date/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ studentId: 'student-1', examDate: '2026-05-01T00:00:00.000Z' }), headers: { 'Content-Type': 'application/json' } })
    const res = await POST(req as any) as any
    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalled()
  })
})
