 
jest.mock('@/lib/prisma', () => ({ prisma: { regenerationJob: { updateMany: jest.fn(), findUnique: jest.fn() }, $transaction: jest.fn() } }))

import { prisma } from '@/lib/prisma'
import { claimJob } from '@/worker/processors/regenerationWorker'

beforeEach(() => {
  jest.clearAllMocks()
})

test('successful claim returns job and sets status to RUNNING', async () => {
  (prisma as any).$transaction.mockImplementation(async (fn: any) => fn({ regenerationJob: (prisma as any).regenerationJob }))
  ;(prisma as any).regenerationJob.updateMany.mockResolvedValue({ count: 1 })
  const jobObj = { id: 'job1', status: 'RUNNING' }
  ;(prisma as any).regenerationJob.findUnique.mockResolvedValue(jobObj)

  const res = await claimJob('job1')
  expect(res).toEqual(jobObj)

  expect((prisma as any).regenerationJob.updateMany).toHaveBeenCalled()
  const callArg = ((prisma as any).regenerationJob.updateMany as jest.Mock).mock.calls[0][0]
  expect(callArg.where).toEqual({ id: 'job1', status: 'PENDING' })
  expect(callArg.data).toHaveProperty('status', 'RUNNING')
  expect(callArg.data).toHaveProperty('lockedAt')
})

test('double-claim prevented: second claim returns null', async () => {
  (prisma as any).$transaction.mockImplementation(async (fn: any) => fn({ regenerationJob: (prisma as any).regenerationJob }))
  // First call returns count=1, second returns count=0
  let call = 0
  ;(prisma as any).regenerationJob.updateMany.mockImplementation(async () => {
    call++
    return call === 1 ? { count: 1 } : { count: 0 }
  })
  ;(prisma as any).regenerationJob.findUnique.mockResolvedValue({ id: 'job2', status: 'RUNNING' })

  const first = await claimJob('job2')
  expect(first).toEqual({ id: 'job2', status: 'RUNNING' })

  const second = await claimJob('job2')
  expect(second).toBeNull()
})
