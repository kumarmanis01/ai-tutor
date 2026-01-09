jest.mock('@/lib/prisma', () => ({ prisma: { regenerationJob: { findFirst: jest.fn(), updateMany: jest.fn(), update: jest.fn() }, $transaction: jest.fn(), regenerationOutput: { create: jest.fn() } } }))
jest.mock('@/lib/audit/log', () => jest.fn())
jest.mock('@/regeneration/generatorAdapter', () => jest.fn())

import { processNextJob } from '@/worker/processors/regenerationWorker'
import { prisma } from '@/lib/prisma'
import logAuditEvent from '@/lib/audit/log'
import generatorAdapter from '@/regeneration/generatorAdapter'
import { AuditEvents } from '@/lib/audit/events'

const mockedPrisma = prisma as any
const mockedLogAudit = logAuditEvent as jest.MockedFunction<any>
const mockedGenerator = generatorAdapter as jest.MockedFunction<any>

beforeEach(() => {
  jest.clearAllMocks()
})

test('processNextJob persists output exactly once and emits COMPLETED audit', async () => {
  mockedPrisma.regenerationJob.findFirst.mockResolvedValue({ id: 'job1' })

  const tx = {
    regenerationJob: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ id: 'job1', status: 'RUNNING', suggestionId: 's1', targetType: 'LESSON', targetId: 't1', instructionJson: {} }),
    },
  }
  mockedPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx))

  mockedGenerator.mockResolvedValue({ outputJson: { foo: 'bar' } })
  mockedPrisma.regenerationOutput.create.mockResolvedValue({ id: 'out1', createdAt: new Date() })
  mockedPrisma.regenerationJob.updateMany.mockResolvedValue({ count: 1 })

  const res = await processNextJob()
  expect(res).toBeDefined()

  // output persisted
  expect(mockedPrisma.regenerationOutput.create).toHaveBeenCalled()

  // job marked completed atomically
  expect(mockedPrisma.regenerationJob.updateMany).toHaveBeenCalled()

  // audits: LOCKED, STARTED, COMPLETED at least
  expect(mockedLogAudit).toHaveBeenCalled()
  const actions = mockedLogAudit.mock.calls.map((c: any) => c[1]?.action || c[0]?.action)
  expect(actions).toEqual(expect.arrayContaining([AuditEvents.REGEN_JOB_COMPLETED]))
})

test('processNextJob marks FAILED and emits FAILED audit when generator throws', async () => {
  mockedPrisma.regenerationJob.findFirst.mockResolvedValue({ id: 'job2' })

  const tx = {
    regenerationJob: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ id: 'job2', status: 'RUNNING', suggestionId: 's2', targetType: 'LESSON', targetId: 't2', instructionJson: {} }),
    },
  }
  mockedPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx))

  mockedGenerator.mockImplementation(async () => { throw new Error('boom') })
  mockedPrisma.regenerationJob.update.mockResolvedValue({})

  const res = await processNextJob()
  expect(res).toBeDefined()

  // output not created
  expect(mockedPrisma.regenerationOutput.create).not.toHaveBeenCalled()

  // job update to FAILED called
  expect(mockedPrisma.regenerationJob.update).toHaveBeenCalled()

  // audit FAILED emitted
  const actions = mockedLogAudit.mock.calls.map((c: any) => c[1]?.action || c[0]?.action)
  expect(actions).toEqual(expect.arrayContaining([AuditEvents.REGEN_JOB_FAILED]))
})
