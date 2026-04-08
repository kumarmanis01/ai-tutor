import runMonthlyMisconceptionPrevalence from '@/worker/services/misconceptionPrevalenceWorker'
import { prismaMock } from '../../helpers/prismaMock'

jest.mock('@/lib/prisma.js', () => ({ prisma: prismaMock }))
jest.mock('@/lib/logger.js', () => ({ logger: { info: jest.fn(), error: jest.fn() } }))

describe('misconceptionPrevalenceWorker', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('updates prevalenceRate for each misconception', async () => {
    prismaMock.misconception.findMany = jest.fn().mockResolvedValue([
      { id: 'm-1', conceptId: 'c-1' },
      { id: 'm-2', conceptId: 'c-2' },
    ])

    // Return detection counts via $queryRaw
    prismaMock.$queryRaw = jest.fn()
      .mockResolvedValueOnce([{ cnt: BigInt(5) }])
      .mockResolvedValueOnce([{ cnt: BigInt(0) }])

    prismaMock.answerEvent = {
      count: jest.fn()
        .mockResolvedValueOnce(50) // attempts for c-1
        .mockResolvedValueOnce(0), // attempts for c-2
    } as any

    prismaMock.misconception.update = jest.fn().mockResolvedValue(true)

    const res = await runMonthlyMisconceptionPrevalence()

    expect(res.updated).toBe(2)
    expect(prismaMock.misconception.update).toHaveBeenCalledTimes(2)
    expect(prismaMock.misconception.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'm-1' }, data: { prevalenceRate: 5 / 50 } }))
  })
})
