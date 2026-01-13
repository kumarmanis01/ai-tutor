import makeRetryService from '@/lib/regeneration/retryService'
// makeRetryIntentStore is not used in these unit tests
import * as audit from '@/lib/audit/log'

describe('retryService', () => {
  const tx: any = {
    regenerationJob: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    retryIntent: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  }

  const prisma: any = {
    $transaction: jest.fn((cb: any) => Promise.resolve(cb(tx))),
  }

  beforeEach(() => {
    jest.resetAllMocks()
    // ensure $transaction mock logs when invoked
    prisma.$transaction = jest.fn(async (cb: any) => {
      return await cb(tx)
    })
  })

  test('creates job from intent when intent pending', async () => {
    // mock consumed intent via tx.retryIntent
    const consumed = { id: 'ri1', sourceJobId: 'sj1' }
    tx.retryIntent.updateMany.mockResolvedValue({ count: 1 })
    tx.retryIntent.findUnique.mockResolvedValue(consumed)
    // source job with instructionJson
    tx.regenerationJob.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === 'sj1') return Promise.resolve({ id: 'sj1', instructionJson: { foo: 'bar' }, suggestionId: 's1', targetType: 'LESSON', targetId: 't1', createdBy: 'u1' })
      if (where.retryIntentId === 'ri1') return Promise.resolve(null)
      return Promise.resolve(null)
    })

    tx.regenerationJob.create.mockResolvedValue({ id: 'newJob' })

    jest.spyOn(audit, 'logAuditEvent').mockImplementation(() => undefined)

    const service = makeRetryService(prisma)
    const created = await service.createRetryJobFromIntent('ri1')
    expect(created.id).toBe('newJob')
    expect(tx.regenerationJob.create).toHaveBeenCalled()
    expect(audit.logAuditEvent).toHaveBeenCalled()
  })

  test('double execution blocked when job exists', async () => {
    // prepare tx to simulate existing job
    tx.regenerationJob.findUnique.mockImplementation(({ where }: any) => {
      if (where.retryIntentId === 'ri2') return Promise.resolve({ id: 'existing' })
      if (where.id === 'sj2') return Promise.resolve({ id: 'sj2', instructionJson: {} })
      return Promise.resolve(null)
    })

    const service = makeRetryService(prisma)
    await expect(service.createRetryJobFromIntent('ri2')).rejects.toThrow('retry intent already executed')
    expect(tx.regenerationJob.create).not.toHaveBeenCalled()
  })

  test('transactional: if consume fails, no job created', async () => {
    tx.retryIntent.updateMany.mockRejectedValue(new Error('consume failed'))
    tx.retryIntent.findUnique.mockRejectedValue(new Error('consume failed'))
    tx.regenerationJob.findUnique.mockResolvedValue(null)
    tx.regenerationJob.create.mockResolvedValue({ id: 'should-not-be' })

    const service = makeRetryService(prisma)
    await expect(service.createRetryJobFromIntent('ri3')).rejects.toThrow('consume failed')
    expect(tx.regenerationJob.create).not.toHaveBeenCalled()
  })
})
