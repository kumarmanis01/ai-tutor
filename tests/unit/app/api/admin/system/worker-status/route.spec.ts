import { jest } from '@jest/globals'

// Mock session helper and prisma
jest.unstable_mockModule('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}))

jest.unstable_mockModule('@/lib/prisma', () => ({
  prisma: {
    workerLifecycle: {
      findFirst: jest.fn(),
    },
  },
}))

const { GET } = await import('../../../../../../app/api/admin/system/worker-status/route')
const { getServerSessionForHandlers } = await import('@/lib/session') as any
const { prisma } = await import('@/lib/prisma') as any

describe('GET /api/admin/system/worker-status', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns false statuses for unauthenticated requests', async () => {
    (getServerSessionForHandlers as jest.Mock).mockResolvedValue(null)
    const res: any = await GET()
    const body = await res.json()
    expect(body.worker.alive).toBe(false)
    expect(body.scheduler.alive).toBe(false)
  })

  it('returns worker and scheduler status for admin', async () => {
    (getServerSessionForHandlers as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })

    const mockWorker = { type: 'content-hydration', lastHeartbeatAt: new Date() }
    const mockScheduler = { type: 'scheduler', lastHeartbeatAt: new Date() }

    // First call -> workerRow, second call -> schedulerRow
    ;(prisma.workerLifecycle.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockWorker)
      .mockResolvedValueOnce(mockScheduler)

    const res: any = await GET()
    const body = await res.json()
    expect(body.worker.alive).toBe(true)
    expect(body.scheduler.alive).toBe(true)
    expect(body.worker.type).toBe('content-hydration')
    expect(body.scheduler.type).toBe('scheduler')
  })
})
