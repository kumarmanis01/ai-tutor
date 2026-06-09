// CJS-compatible version of worker-status route tests.
// Converted from ESM (jest.unstable_mockModule / top-level await) which is not
// supported by ts-jest in CommonJS mode.

jest.mock('@/lib/session', () => ({
  getServerSessionForHandlers: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    workerLifecycle: {
      findFirst: jest.fn(),
    },
  },
}))

import { GET } from '@/app/api/admin/system/worker-status/route'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const mockGetSession = getServerSessionForHandlers as jest.Mock
const mockFindFirst = (prisma.workerLifecycle.findFirst as jest.Mock)

describe('GET /api/admin/system/worker-status', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns false statuses for unauthenticated requests', async () => {
    mockGetSession.mockResolvedValue(null)
    const res: any = await GET()
    const body = await res.json()
    expect(body.worker.alive).toBe(false)
    expect(body.scheduler.alive).toBe(false)
  })

  it('returns worker and scheduler status for admin', async () => {
    mockGetSession.mockResolvedValue({ user: { role: 'admin' } })

    const mockWorker = { type: 'content-hydration', lastHeartbeatAt: new Date() }
    const mockScheduler = { type: 'scheduler', lastHeartbeatAt: new Date() }

    mockFindFirst
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
