jest.mock('@/lib/prisma', () => ({ prisma: { regenerationJob: { findFirst: jest.fn() }, $transaction: jest.fn() } }))
jest.mock('@/lib/audit/log', () => jest.fn())

import { processNextJob } from '@/worker/processors/regenerationWorker'
import { prisma } from '@/lib/prisma'
import logAuditEvent from '@/lib/audit/log'

const mockedPrisma = prisma as any
const mockedLogAudit = logAuditEvent as jest.MockedFunction<any>

beforeEach(() => {
  jest.clearAllMocks()
})

test('processNextJob claims pending job and emits audits', async () => {
  // findFirst on top-level regenerationJob
  mockedPrisma.regenerationJob.findFirst.mockResolvedValue({ id: 'job1' })

  // $transaction should call provided function with tx that has updateMany/findUnique
  const tx = {
    regenerationJob: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ id: 'job1', status: 'RUNNING' }),
    },
  }
  mockedPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx))

  const res = await processNextJob()
  expect(res).toBeTruthy()
  if (res) expect(res.id).toBe('job1')

  // audit called for LOCKED and STARTED
  expect(mockedLogAudit).toHaveBeenCalled()
  // Because logAuditEvent signature may vary, just ensure it's been called
  expect(mockedLogAudit.mock.calls.length).toBeGreaterThanOrEqual(2)
})

test('processNextJob returns null when claim fails and does not emit audits', async () => {
  mockedPrisma.regenerationJob.findFirst.mockResolvedValue({ id: 'job2' })

  const tx = {
    regenerationJob: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn(),
    },
  }
  mockedPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx))

  const res = await processNextJob()
  expect(res).toBeNull()
  expect(mockedLogAudit).not.toHaveBeenCalled()
})
