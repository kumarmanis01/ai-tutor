import makeRetryIntentStore from '@/lib/retryIntent/store'

describe('RetryIntent store', () => {
  const prisma: any = {
    regenerationJob: { findUnique: jest.fn() },
    retryIntent: { create: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
  }

  const store = makeRetryIntentStore(prisma)

  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('createRetryIntent throws if source job not found', async () => {
    prisma.regenerationJob.findUnique.mockResolvedValue(null)
    await expect(
      store.createRetryIntent({ sourceJobId: 'nope', reasonCode: 'OTHER', reasonText: 'r', approvedBy: 'admin' })
    ).rejects.toThrow('source job not found')
  })

  test('createRetryIntent throws if job not FAILED', async () => {
    prisma.regenerationJob.findUnique.mockResolvedValue({ id: '1', status: 'PENDING' })
    await expect(
      store.createRetryIntent({ sourceJobId: '1', reasonCode: 'OTHER', reasonText: 'r', approvedBy: 'admin' })
    ).rejects.toThrow('only FAILED jobs may be retried')
  })

  test('createRetryIntent creates when job is FAILED', async () => {
    prisma.regenerationJob.findUnique.mockResolvedValue({ id: '1', status: 'FAILED' })
    prisma.retryIntent.create.mockResolvedValue({ id: 'ri1', sourceJobId: '1', status: 'PENDING' })
    const created = await store.createRetryIntent({ sourceJobId: '1', reasonCode: 'OTHER', reasonText: 'r', approvedBy: 'admin' })
    expect(created.id).toBe('ri1')
    expect(prisma.retryIntent.create).toHaveBeenCalled()
  })

  test('consumeRetryIntent transitions when pending', async () => {
    prisma.retryIntent.updateMany.mockResolvedValue({ count: 1 })
    prisma.retryIntent.findUnique.mockResolvedValue({ id: 'ri1', status: 'CONSUMED' })
    const consumed = await store.consumeRetryIntent('ri1')
    expect(prisma.retryIntent.updateMany).toHaveBeenCalledWith({ where: { id: 'ri1', status: 'PENDING' }, data: { status: 'CONSUMED' } })
    expect(consumed?.id).toBe('ri1')
  })

  test('consumeRetryIntent throws when not found', async () => {
    prisma.retryIntent.updateMany.mockResolvedValue({ count: 0 })
    prisma.retryIntent.findUnique.mockResolvedValue(null)
    await expect(store.consumeRetryIntent('missing')).rejects.toThrow('retry intent not found')
  })

  test('consumeRetryIntent throws when already consumed', async () => {
    prisma.retryIntent.updateMany.mockResolvedValue({ count: 0 })
    prisma.retryIntent.findUnique.mockResolvedValue({ id: 'ri1', status: 'CONSUMED' })
    await expect(store.consumeRetryIntent('ri1')).rejects.toThrow('retry intent already consumed or rejected')
  })
})
