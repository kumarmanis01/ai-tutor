jest.mock('@/lib/prisma', () => ({
  prisma: {
    executionJob: { findUnique: jest.fn(), update: jest.fn() },
    jobExecutionLog: { create: jest.fn() },
    hydrationJob: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    systemSetting: { findUnique: jest.fn() }
  }
}))
// Note: hydrator and syllabusWorker modules are mocked dynamically inside tests
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }))
jest.mock('bullmq', () => {
  const callbacks: any = {}
  const Worker = jest.fn().mockImplementation((queueName: string, processor: any, opts: any) => {
    return {
      on: (evt: string, cb: any) => { callbacks[evt] = cb },
      __callbacks: callbacks
    }
  })
  return { Worker }
})

import { prisma } from '@/lib/prisma'

describe('contentWorker lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('processContentJob creates HydrationJob and emits STARTED log', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('@/hydrators/hydrateNotes', () => ({ hydrateNotes: jest.fn() }))
      jest.doMock('@/hydrators/hydrateQuestions', () => ({ hydrateQuestions: jest.fn() }))
      jest.doMock('@/hydrators/assembleTest', () => ({ assembleTest: jest.fn() }))
      jest.doMock('@/worker/services/syllabusWorker', () => ({ handleSyllabusJob: jest.fn() }))

      const mod = await import('@/worker/processors/contentWorker')
      const { processContentJob } = mod

      const job = {
        id: 'bull-1',
        name: 'syllabus-bull-1',
        data: { type: 'SYLLABUS', payload: { jobId: 'exec-1', executionJobId: 'exec-1' } }
      } as any

      ;(prisma.executionJob.findUnique as jest.Mock).mockResolvedValue({ id: 'exec-1', entityType: 'SUBJECT', entityId: 'sub-1', payload: {} })
      ;(prisma.hydrationJob.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.hydrationJob.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.hydrationJob.create as jest.Mock).mockResolvedValue({ id: 'hyd-1' })
      const svc = require(path.join(workerRoot, 'worker', 'services', 'syllabusWorker.js'))
      ;(svc.handleSyllabusJob as jest.Mock).mockResolvedValue(true)

      await processContentJob(job)

      expect(prisma.executionJob.findUnique).toHaveBeenCalledWith({ where: { id: 'exec-1' } })
      expect(prisma.hydrationJob.create).toHaveBeenCalled()
      expect(svc.handleSyllabusJob).toHaveBeenCalledWith('hyd-1')
      expect(prisma.jobExecutionLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'STARTED' }) }))
    })
  })

  test('startContentWorker registers completed and failed handlers that finalize ExecutionJob', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('@/hydrators/hydrateNotes', () => ({ hydrateNotes: jest.fn() }))
      jest.doMock('@/hydrators/hydrateQuestions', () => ({ hydrateQuestions: jest.fn() }))
      jest.doMock('@/hydrators/assembleTest', () => ({ assembleTest: jest.fn() }))
      jest.doMock('@/worker/services/syllabusWorker', () => ({ handleSyllabusJob: jest.fn() }))

      const mod = await import('@/worker/processors/contentWorker')
      // start worker (uses mocked Worker and captures callbacks)
      const worker = mod.startContentWorker({ concurrency: 1 }) as any
      const callbacks = (worker as any).__callbacks

      // simulate completed
      const completedJob = { id: 'bull-2', data: { type: 'SYLLABUS', payload: { executionJobId: 'exec-2' } } }
      await callbacks['completed'](completedJob)

      expect(prisma.executionJob.update).toHaveBeenCalledWith({ where: { id: 'exec-2' }, data: { status: 'completed' } })
      expect(prisma.jobExecutionLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'COMPLETED' }) }))

      // simulate failed
      const failedJob = { id: 'bull-3', data: { type: 'SYLLABUS', payload: { executionJobId: 'exec-3' } } }
      const err = new Error('boom')
      await callbacks['failed'](failedJob, err)

      expect(prisma.executionJob.update).toHaveBeenCalledWith({ where: { id: 'exec-3' }, data: { status: 'failed', lastError: String(err?.message ?? err) } })
      expect(prisma.jobExecutionLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'FAILED' }) }))
    })
  })
})
