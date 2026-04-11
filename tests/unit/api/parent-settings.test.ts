/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'
import '../../helpers/mockSession'

describe('Parent settings API', () => {
  beforeEach(() => {
    resetPrismaMock()
    ;(global as any).__TEST_SESSION__ = { user: { id: 'parent-1', role: 'parent', email: 'parent@example.test' } }
    // Ensure no linked children by default for GET
    prismaMock.parentStudent.findMany.mockResolvedValue([])
  })

  it('GET returns profile defaults when profile missing', async () => {
    prismaMock.parentProfile.findUnique.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' })

    const { GET } = await import('@/app/api/parent/settings/route')
    const response = await GET() as any
    const data = await response.json()

    expect(data.digestOptOut).toBe(false)
    expect(data.digestDay).toBe('Sunday')
    expect(data.digestTime).toBe('09:00')
    expect(data.digestTimezone).toBe('Asia/Kolkata')
  })

  it('POST upserts profile and returns ok', async () => {
    prismaMock.parentProfile.upsert.mockResolvedValue({ userId: 'parent-1', digestOptOut: true, digestDay: 'Monday', digestTime: '08:30', digestTimezone: 'Asia/Kolkata' })

    const { POST } = await import('@/app/api/parent/settings/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ digestOptOut: true, digestDay: 'Monday', digestTime: '08:30', digestTimezone: 'Asia/Kolkata' }), headers: { 'Content-Type': 'application/json' } })
    const response = await POST(req as any) as any
    const data = await response.json()

    expect(data.ok).toBe(true)
    expect(prismaMock.parentProfile.upsert).toHaveBeenCalled()
  })
})
