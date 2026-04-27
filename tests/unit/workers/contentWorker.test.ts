jest.mock('@/lib/prisma', () => ({
  prisma: {
    executionJob: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    jobExecutionLog: { create: jest.fn().mockResolvedValue(null) },
    hydrationJob: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn().mockResolvedValue(null) },
    chapterDef: { findFirst: jest.fn() },
    systemSetting: { findUnique: jest.fn() }
  }
}))
// Note: hydrator and syllabusWorker modules are mocked dynamically inside tests
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }))
jest.mock('bullmq', () => {
  const callbacks: any = {}
  const Worker = jest.fn().mockImplementation((queueName: string, processor: any, opts: any) => {
    // reference args to avoid unused-var lint warnings
    void queueName; void processor; void opts
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
      ;(prisma.hydrationJob.findUnique as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'hyd-1', subjectId: 'sub-1' })
      ;(prisma.hydrationJob.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.hydrationJob.create as jest.Mock).mockResolvedValue({ id: 'hyd-1', subjectId: 'sub-1' })
      ;(prisma.chapterDef.findFirst as jest.Mock).mockResolvedValue({ id: 'chap-1', subjectId: 'sub-1' })
      const svc = await import('@/worker/services/syllabusWorker')
      ;(svc as any).handleSyllabusJob.mockResolvedValue(true)

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
      ;(prisma.hydrationJob.findUnique as jest.Mock).mockResolvedValue({ id: 'hyd-2', subjectId: 'sub-2' })
      ;(prisma.executionJob.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'exec-2', payload: { hydrationJobId: 'hyd-2' } })
      ;(prisma.executionJob.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'exec-2' })
      ;(prisma.chapterDef.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'chap-2', subjectId: 'sub-2' })
      await callbacks['completed'](completedJob)

      expect(prisma.jobExecutionLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'COMPLETED' }) }))

      // simulate failed
      const failedJob = { id: 'bull-3', data: { type: 'SYLLABUS', payload: { executionJobId: 'exec-3' } } }
      const err = new Error('boom')
      ;(prisma.hydrationJob.findUnique as jest.Mock).mockResolvedValueOnce(null)
      await callbacks['failed'](failedJob, err)

      // Workers should NOT mutate ExecutionJob state; they must emit FAILED audit logs instead
      expect(prisma.executionJob.update).not.toHaveBeenCalled()
      expect(prisma.jobExecutionLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ event: 'FAILED', jobId: 'exec-3' }) }))
    })
  })
})
