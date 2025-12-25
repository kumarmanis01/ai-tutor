import { POST } from '../../app/api/admin/regeneration-jobs/[id]/trigger/route'
import { requireAdminOrModerator } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditEvents } from '@/lib/audit/events'
import { logAuditEvent } from '@/lib/audit/log'

jest.mock('@/lib/auth', () => ({ requireAdminOrModerator: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }))
jest.mock('@/lib/audit/log', () => ({ logAuditEvent: jest.fn() }))

const mockedRequire = requireAdminOrModerator as jest.MockedFunction<any>
const mockedLogAudit = logAuditEvent as jest.MockedFunction<any>
const mockedTx = {
  regenerationJob: {
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('triggers PENDING job and writes audit', async () => {
  mockedRequire.mockResolvedValue({ user: { id: 'admin1' } })
  ;(prisma as any).$transaction.mockImplementation(async (fn: any) => fn(mockedTx))

  mockedTx.regenerationJob.updateMany.mockResolvedValue({ count: 1 })
  mockedTx.regenerationJob.findUnique.mockResolvedValue({ id: 'job1', status: 'RUNNING' })

  const res = await POST({} as Request, { params: { jobId: 'job1' } } as any)
  expect(res.status).toBe(200)
  const body = JSON.parse(await res.text())
  expect(body.job).toBeDefined()
  expect(mockedLogAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: AuditEvents.REGEN_JOB_TRIGGERED, entityId: 'job1' }))
})

test('returns 404 when job not found', async () => {
  mockedRequire.mockResolvedValue({ user: { id: 'admin1' } })
  ;(prisma as any).$transaction.mockImplementation(async (fn: any) => fn(mockedTx))
  mockedTx.regenerationJob.updateMany.mockResolvedValue({ count: 0 })
  mockedTx.regenerationJob.findUnique.mockResolvedValue(null)

  const res = await POST({} as Request, { params: { jobId: 'missing' } } as any)
  expect(res.status).toBe(404)
})

test('returns 409 when job not PENDING', async () => {
  mockedRequire.mockResolvedValue({ user: { id: 'admin1' } })
  ;(prisma as any).$transaction.mockImplementation(async (fn: any) => fn(mockedTx))
  mockedTx.regenerationJob.updateMany.mockResolvedValue({ count: 0 })
  mockedTx.regenerationJob.findUnique.mockResolvedValue({ id: 'job2', status: 'RUNNING' })

  const res = await POST({} as Request, { params: { jobId: 'job2' } } as any)
  expect(res.status).toBe(409)
})
