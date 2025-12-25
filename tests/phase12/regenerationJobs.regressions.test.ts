import fs from 'fs'
import path from 'path'
import * as route from '../../app/api/admin/regeneration-jobs/[id]/trigger/route'
import { requireAdminOrModerator } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/auth', () => ({ requireAdminOrModerator: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }))

const mockedRequire = requireAdminOrModerator as jest.MockedFunction<any>

const makeTx = () => ({
  regenerationJob: {
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  mockedRequire.mockResolvedValue({ user: { id: 'admin1' } })
})

test('cannot trigger the same job twice (second call returns 409)', async () => {
  const tx1 = makeTx()
  const tx2 = makeTx()

  // first transaction: claim succeeds
  tx1.regenerationJob.updateMany.mockResolvedValue({ count: 1 })
  tx1.regenerationJob.findUnique.mockResolvedValue({ id: 'job1', status: 'RUNNING' })

  // second transaction: claim fails because status changed
  tx2.regenerationJob.updateMany.mockResolvedValue({ count: 0 })
  tx2.regenerationJob.findUnique.mockResolvedValue({ id: 'job1', status: 'RUNNING' })

  let call = 0
  ;(prisma as any).$transaction.mockImplementation(async (fn: any) => {
    call++
    return fn(call === 1 ? tx1 : tx2)
  })

  const res1 = await route.POST({} as Request, { params: { jobId: 'job1' } } as any)
  expect(res1.status).toBe(200)

  const res2 = await route.POST({} as Request, { params: { jobId: 'job1' } } as any)
  expect(res2.status).toBe(409)
})

test('cannot trigger COMPLETED or FAILED jobs', async () => {
  const tx = makeTx()
  ;(prisma as any).$transaction.mockImplementation(async (fn: any) => fn(tx))

  tx.regenerationJob.updateMany.mockResolvedValue({ count: 0 })
  tx.regenerationJob.findUnique.mockResolvedValue({ id: 'job2', status: 'COMPLETED' })
  const resCompleted = await route.POST({} as Request, { params: { jobId: 'job2' } } as any)
  expect(resCompleted.status).toBe(409)

  tx.regenerationJob.findUnique.mockResolvedValue({ id: 'job3', status: 'FAILED' })
  const resFailed = await route.POST({} as Request, { params: { jobId: 'job3' } } as any)
  expect(resFailed.status).toBe(409)
})

test('unsupported HTTP methods return 405', async () => {
  const g = await route.GET()
  expect(g.status).toBe(405)
  const p = await route.PUT()
  expect(p.status).toBe(405)
  const pa = await route.PATCH()
  expect(pa.status).toBe(405)
  const d = await route.DELETE()
  expect(d.status).toBe(405)
})

test('trigger route does not import or call generators', async () => {
  const file = fs.readFileSync(path.join(__dirname, '../../app/api/admin/regeneration-jobs/[id]/trigger/route.ts'), 'utf8')
  expect(file).not.toMatch(/generatorAdapter|generate|generator/)
})

test('status transition only modifies status column', async () => {
  const tx = makeTx()
  ;(prisma as any).$transaction.mockImplementation(async (fn: any) => fn(tx))

  tx.regenerationJob.updateMany.mockResolvedValue({ count: 1 })
  tx.regenerationJob.findUnique.mockResolvedValue({ id: 'job4', status: 'RUNNING' })

  await route.POST({} as Request, { params: { jobId: 'job4' } } as any)

  expect(tx.regenerationJob.updateMany).toHaveBeenCalled()
  const callArg = (tx.regenerationJob.updateMany as jest.Mock).mock.calls[0][0]
  expect(callArg).toHaveProperty('data')
  expect(callArg.data).toEqual({ status: 'RUNNING' })
  // ensure no other fields were changed
  expect(Object.keys(callArg.data)).toEqual(['status'])
})
