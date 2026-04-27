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

  it('should return 401 when unauthenticated', async () => {
    ;(global as any).__TEST_SESSION__ = null
    const { GET } = await import('@/app/api/parent/settings/route')
    const response = await GET() as any
    expect(response.status).toBe(401)
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
    // F-PAR-021 AC-01: inactivityThresholdDays defaults to 3
    expect(data.inactivityThresholdDays).toBe(3)
  })

  it('GET returns stored inactivityThresholdDays from profile', async () => {
    prismaMock.parentProfile.findUnique.mockResolvedValue({
      digestOptOut: false, inactivityOptOut: false, digestDay: 'Sunday', digestTime: '09:00',
      digestTimezone: null, inactivityThresholdDays: 7,
    } as any)
    prismaMock.user.findUnique.mockResolvedValue({ timezone: null })

    const { GET } = await import('@/app/api/parent/settings/route')
    const response = await GET() as any
    const data = await response.json()
    expect(data.inactivityThresholdDays).toBe(7)
  })

  it('POST upserts profile and returns ok', async () => {
    prismaMock.parentProfile.upsert.mockResolvedValue({
      userId: 'parent-1', digestOptOut: true, digestDay: 'Monday', digestTime: '08:30',
      digestTimezone: 'Asia/Kolkata', inactivityThresholdDays: 5,
    } as any)

    const { POST } = await import('@/app/api/parent/settings/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ digestOptOut: true, digestDay: 'Monday', digestTime: '08:30', digestTimezone: 'Asia/Kolkata', inactivityThresholdDays: 5 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(req as any) as any
    const data = await response.json()

    expect(data.ok).toBe(true)
    expect(prismaMock.parentProfile.upsert).toHaveBeenCalled()
    // Verify inactivityThresholdDays was written
    const upsertCall = prismaMock.parentProfile.upsert.mock.calls[0][0] as any
    expect(upsertCall.update.inactivityThresholdDays).toBe(5)
  })

  it('POST rejects invalid inactivityThresholdDays values', async () => {
    const { POST } = await import('@/app/api/parent/settings/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ inactivityThresholdDays: 4 }), // 4 is not in [2,3,5,7]
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(req as any) as any
    expect(response.status).toBe(400)
  })

  it('POST accepts all valid threshold values (2, 3, 5, 7)', async () => {
    const { POST } = await import('@/app/api/parent/settings/route')
    for (const val of [2, 3, 5, 7]) {
      prismaMock.parentProfile.upsert.mockResolvedValue({ inactivityThresholdDays: val } as any)
      const req = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ inactivityThresholdDays: val }),
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(req as any) as any
      expect(response.status).toBe(200)
    }
  })
})
