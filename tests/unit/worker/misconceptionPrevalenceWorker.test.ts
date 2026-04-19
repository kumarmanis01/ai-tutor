import runMonthlyMisconceptionPrevalence from '@/worker/services/misconceptionPrevalenceWorker'
import { prismaMock } from '../../helpers/prismaMock'

// Use require inside mock factory to avoid jest hoisting initialization order issues
jest.mock('@/lib/prisma.js', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }))
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

  it('creates a system alert when prevalence exceeds threshold', async () => {
    prismaMock.misconception.findMany = jest.fn().mockResolvedValue([{ id: 'm-high', conceptId: 'c-high' }])
    prismaMock.$queryRaw = jest.fn().mockResolvedValue([{ cnt: BigInt(30) }]) // 30 detections
    prismaMock.answerEvent = { count: jest.fn().mockResolvedValue(50) } as any // 50 attempts -> 0.6 prevalence
    prismaMock.misconception.update = jest.fn().mockResolvedValue(true)

    // Provide full misconception row and no existing alert
    prismaMock.misconception.findUnique = jest.fn().mockResolvedValue({ id: 'm-high', name: 'HighMis', conceptId: 'c-high', subjectId: 's-1' })
    prismaMock.systemAlert = { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(true), update: jest.fn() } as any

    const res = await runMonthlyMisconceptionPrevalence()

    expect(res.updated).toBe(1)
    expect(prismaMock.systemAlert.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.systemAlert.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'MISCONCEPTION_HIGH_PREVALENCE' }) }))
  })

  it('updates existing alert when prevalence remains high', async () => {
    prismaMock.misconception.findMany = jest.fn().mockResolvedValue([{ id: 'm-exist', conceptId: 'c-exist' }])
    prismaMock.$queryRaw = jest.fn().mockResolvedValue([{ cnt: BigInt(40) }]) // 40 detections
    prismaMock.answerEvent = { count: jest.fn().mockResolvedValue(50) } as any // 0.8 prevalence
    prismaMock.misconception.update = jest.fn().mockResolvedValue(true)

    prismaMock.misconception.findUnique = jest.fn().mockResolvedValue({ id: 'm-exist', name: 'ExistMis', conceptId: 'c-exist', subjectId: 's-2' })
    prismaMock.systemAlert = { findFirst: jest.fn().mockResolvedValue({ id: 'alert-1', active: true }), update: jest.fn(), create: jest.fn() } as any

    const res = await runMonthlyMisconceptionPrevalence()

    expect(res.updated).toBe(1)
    expect(prismaMock.systemAlert.update).toHaveBeenCalledTimes(1)
  })

  it('resolves existing active alert when prevalence drops below threshold', async () => {
    prismaMock.misconception.findMany = jest.fn().mockResolvedValue([{ id: 'm-resolve', conceptId: 'c-res' }])
    prismaMock.$queryRaw = jest.fn().mockResolvedValue([{ cnt: BigInt(2) }]) // 2 detections
    prismaMock.answerEvent = { count: jest.fn().mockResolvedValue(50) } as any // 0.04 prevalence
    prismaMock.misconception.update = jest.fn().mockResolvedValue(true)

    prismaMock.misconception.findUnique = jest.fn().mockResolvedValue({ id: 'm-resolve', name: 'ResolveMis', conceptId: 'c-res', subjectId: 's-3' })
    prismaMock.systemAlert = { findFirst: jest.fn().mockResolvedValue({ id: 'alert-2', active: true }), update: jest.fn(), create: jest.fn() } as any

    const res = await runMonthlyMisconceptionPrevalence()

    expect(res.updated).toBe(1)
    expect(prismaMock.systemAlert.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'alert-2' }, data: expect.objectContaining({ active: false }) }))
  })

  it('logs alert errors but continues processing', async () => {
    prismaMock.misconception.findMany = jest.fn().mockResolvedValue([{ id: 'm-err', conceptId: 'c-err' }])
    prismaMock.$queryRaw = jest.fn().mockResolvedValue([{ cnt: BigInt(10) }])
    prismaMock.answerEvent = { count: jest.fn().mockResolvedValue(10) } as any // prevalence = 1
    prismaMock.misconception.update = jest.fn().mockResolvedValue(true)

    prismaMock.misconception.findUnique = jest.fn().mockResolvedValue({ id: 'm-err', name: 'ErrMis', conceptId: 'c-err', subjectId: 's-4' })
    // systemAlert.findFirst throws to trigger catch
    prismaMock.systemAlert = { findFirst: jest.fn().mockImplementation(() => { throw new Error('alert-fail') }), create: jest.fn(), update: jest.fn() } as any

    const { logger } = require('@/lib/logger.js')

    const res = await runMonthlyMisconceptionPrevalence()

    expect(res.updated).toBe(1)
    expect(logger.error).toHaveBeenCalledWith('misconceptionPrevalence.alert.failed', expect.any(Object))
  })

  it('returns {updated:0} and logs on top-level failure', async () => {
    prismaMock.misconception.findMany = jest.fn().mockImplementation(() => { throw new Error('db down') })
    const { logger } = require('@/lib/logger.js')

    const res = await runMonthlyMisconceptionPrevalence()

    expect(res.updated).toBe(0)
    expect(logger.error).toHaveBeenCalledWith('misconceptionPrevalence.run.failed', expect.any(Object))
  })
})
