jest.mock('@/hydrators/hydrateSyllabus', () => ({
  enqueueSyllabusHydration: jest.fn().mockResolvedValue({ created: true, jobId: 'hyd-1', bullJobId: 'bull-1' })
}))

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subjectDef: { findUnique: jest.fn().mockResolvedValue({ id: 'sub-1', name: 'Mathematics', class: { grade: 6, board: { name: 'CBSE' } } }) },
    executionJob: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'exec-1' }), update: jest.fn().mockResolvedValue(null) },
    jobExecutionLog: { create: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn().mockResolvedValue(null) }
  }
}))

import { submitJob } from '@/lib/execution-pipeline/submitJob'
import { prisma } from '@/lib/prisma'
import { enqueueSyllabusHydration } from '@/hydrators/hydrateSyllabus'

describe('submitJob -> syllabus hydration integration', () => {
  beforeEach(() => jest.clearAllMocks())

  test('creates ExecutionJob and calls hydrateSyllabus, links hydrationJobId', async () => {
    const res = await submitJob({ jobType: 'syllabus', entityType: 'SUBJECT', entityId: 'sub-1', payload: { language: 'en' } as any })

    expect(res.jobId).toBe('exec-1')
    // ExecutionJob was created
    expect(prisma.executionJob.create).toHaveBeenCalled()
    // Hydrator was called with resolved meta
    expect(enqueueSyllabusHydration).toHaveBeenCalledWith(expect.objectContaining({ board: 'CBSE', grade: 6, subject: 'Mathematics' }))
    // ExecutionJob payload updated to include hydrationJobId
    expect(prisma.executionJob.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'exec-1' }, data: expect.objectContaining({ payload: expect.objectContaining({ hydrationJobId: 'hyd-1' }) }) }))
    // JobExecutionLog ENQUEUED written
    expect(prisma.jobExecutionLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ jobId: 'exec-1', event: 'ENQUEUED' }) }))
  })
})
