import makeRetryService from '@/lib/regeneration/retryService'

describe('Phase14 service invariants', () => {
  test('createRetryJobFromIntent creates a new job and does not modify original outputs', async () => {
    const tx: any = {
      regenerationJob: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      regenerationOutput: {
        findUnique: jest.fn(),
        // ensure no update/delete called
        update: jest.fn(),
      },
    }

    const prisma: any = { $transaction: jest.fn(async (cb: any) => cb(tx)) }

    // consumed intent metadata returned by tx.retryIntent.findUnique in store
    tx.retryIntent = { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue({ id: 'ri1', sourceJobId: 'sj1' }) }

    // source job present
    tx.regenerationJob.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === 'sj1') return Promise.resolve({ id: 'sj1', suggestionId: 's1', targetType: 'LESSON', targetId: 't1', instructionJson: { x: 1 }, createdBy: 'u1' })
      if (where.retryIntentId === 'ri1') return Promise.resolve(null)
      return Promise.resolve(null)
    })

    tx.regenerationJob.create.mockResolvedValue({ id: 'newJob' })

    // existing output for original job
    tx.regenerationOutput.findUnique.mockResolvedValue({ id: 'out1', jobId: 'sj1' })

    const service = makeRetryService(prisma)
    const created = await service.createRetryJobFromIntent('ri1')

    expect(created.id).toBe('newJob')
    // ensure no update/delete on outputs (we don't modify originals)
    expect(tx.regenerationOutput.findUnique).not.toHaveBeenCalled()
    expect(tx.regenerationOutput.update).not.toHaveBeenCalled()
  })
})
