import handleSyllabusJob from '../../../worker/services/syllabusWorker'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    hydrationJob: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    systemSetting: { findUnique: jest.fn() },
    chapterDef: { findFirst: jest.fn() },
    subjectDef: { findUnique: jest.fn() },
    $transaction: jest.fn()
  }
}))

jest.mock('@/lib/callLLM', () => ({ callLLM: jest.fn() }))
jest.mock('@/lib/systemSettings', () => ({ isSystemSettingEnabled: jest.fn(() => false) }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }))
jest.mock('@/lib/slug', () => ({ toSlug: (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))

import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/callLLM'

describe('handleSyllabusJob', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('marks job failed when subjectId missing', async () => {
    ;(prisma.hydrationJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.hydrationJob.findUnique as jest.Mock).mockResolvedValue({ id: 'job-1' })

    await handleSyllabusJob('job-1')

    // lastError should follow structured pattern like "<ERROR_CODE>::<short message>"
    expect(prisma.hydrationJob.update).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: { status: expect.anything(), lastError: expect.stringMatching(/^[A-Z0-9_]+::.+/) } })
  })

  test('happy path creates chapters and topics and marks job completed', async () => {
    ;(prisma.hydrationJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.hydrationJob.findUnique as jest.Mock).mockResolvedValue({ id: 'job-2', subjectId: 'sub-1', board: 'CBSE', grade: 5, language: 'en' })
    ;(prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.chapterDef.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.subjectDef.findUnique as jest.Mock).mockResolvedValue({ id: 'sub-1', name: 'Mathematics' })

    const llmOutput = JSON.stringify({ chapters: [{ title: 'Numbers', order: 1, topics: [{ title: 'Integers', order: 1 }] }] })
    ;(callLLM as jest.Mock).mockResolvedValue({ content: llmOutput })

    // Mock transaction - call callback with a tx mock that tracks created records
    const tx = {
      chapterDef: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'chap-1' }) },
      topicDef: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'topic-1' }) },
      hydrationJob: { update: jest.fn().mockResolvedValue({}) },
      executionJob: { findFirst: jest.fn().mockResolvedValue({ id: 'exec-1', status: 'pending' }), update: jest.fn().mockResolvedValue({}), },
      jobExecutionLog: { create: jest.fn().mockResolvedValue({}) }
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx))

    await handleSyllabusJob('job-2')

    expect(tx.chapterDef.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Numbers' }) }))
    expect(tx.topicDef.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Integers' }) }))
    expect(tx.hydrationJob.update).toHaveBeenCalledWith({ where: { id: 'job-2' }, data: { status: 'running', contentReady: true } })
    expect(tx.executionJob.update).not.toHaveBeenCalled()
    expect(tx.jobExecutionLog.create).toHaveBeenCalled()
  })
})
