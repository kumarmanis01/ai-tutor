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
    curriculumChunk: { findMany: jest.fn() },
    curriculumBook: { findFirst: jest.fn() },
    aIContentLog: { create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn()
  }
}))

jest.mock('@/lib/callLLM', () => ({ callLLM: jest.fn() }))
jest.mock('@/lib/systemSettings', () => ({ isSystemSettingEnabled: jest.fn(() => false) }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }))
jest.mock('@/lib/slug', () => ({ toSlug: (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))

import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/callLLM'
import * as syllabusModule from '../../../prompts/syllabus'

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
    // No parsed PDF book for this subject -- fall through to LLM path
    ;(prisma.curriculumBook.findFirst as jest.Mock).mockResolvedValue(null)
    // No NCERT chunks for this subject -- GPT knowledge path
    ;(prisma.curriculumChunk.findMany as jest.Mock).mockResolvedValue([])

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

  test('should inject NCERT chapter hints into prompt when CurriculumChunk rows exist', async () => {
    ;(prisma.hydrationJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.hydrationJob.findUnique as jest.Mock).mockResolvedValue({ id: 'job-3', subjectId: 'sub-2', board: 'CBSE', grade: 6, language: 'en' })
    ;(prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.chapterDef.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.subjectDef.findUnique as jest.Mock).mockResolvedValue({ id: 'sub-2', name: 'Science' })
    // No parsed PDF book -- fall through to LLM+CurriculumChunk path
    ;(prisma.curriculumBook.findFirst as jest.Mock).mockResolvedValue(null)

    // Simulate NCERT chunks for Grade 6 Science (Curiosity book, 2 chapters)
    ;(prisma.curriculumChunk.findMany as jest.Mock).mockResolvedValue([
      { conceptIds: ['chapter:1', 'chunkIndex:0', 'source:ncert'], content: 'Food: Where Does It Come From? All living organisms need food.' },
      { conceptIds: ['chapter:2', 'chunkIndex:0', 'source:ncert'], content: 'Components of Food. Food is made up of nutrients.' },
    ])

    const promptSpy = jest.spyOn(syllabusModule, 'syllabusPrompt')

    const llmOutput = JSON.stringify({ chapters: [
      { title: 'Food: Where Does It Come From?', order: 1, topics: [{ title: 'Sources of Food', order: 1 }] },
      { title: 'Components of Food', order: 2, topics: [{ title: 'Nutrients', order: 1 }] },
    ]})
    ;(callLLM as jest.Mock).mockResolvedValue({ content: llmOutput })

    const tx = {
      chapterDef: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'chap-1' }) },
      topicDef: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'topic-1' }) },
      hydrationJob: { update: jest.fn().mockResolvedValue({}) },
      executionJob: { findFirst: jest.fn().mockResolvedValue(null) },
      jobExecutionLog: { create: jest.fn().mockResolvedValue({}) },
      aIContentLog: { update: jest.fn().mockResolvedValue({}) },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx))

    await handleSyllabusJob('job-3')

    // syllabusPrompt should have been called with ncertChapterHints containing both excerpt strings
    expect(promptSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ncertChapterHints: [
          'Food: Where Does It Come From? All living organisms need food.',
          'Components of Food. Food is made up of nutrients.',
        ],
      })
    )
    // Chapters from NCERT-grounded LLM response should be persisted
    expect(tx.chapterDef.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Food: Where Does It Come From?' }) })
    )

    promptSpy.mockRestore()
  })

  test('PDF-anchored path: seeds ChapterDef + TopicDef from parsed CurriculumBook without calling LLM', async () => {
    ;(prisma.hydrationJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.hydrationJob.findUnique as jest.Mock).mockResolvedValue({ id: 'job-4', subjectId: 'sub-3', board: 'CBSE', grade: 8, language: 'en' })
    ;(prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.chapterDef.findFirst as jest.Mock).mockResolvedValue(null)
    // No NCERT chunks needed for PDF path
    ;(prisma.curriculumChunk.findMany as jest.Mock).mockResolvedValue([])

    // Parsed book with 2 chapters exists for this subject
    ;(prisma.curriculumBook.findFirst as jest.Mock).mockResolvedValue({
      id: 'book-1',
      bookChapters: [
        {
          id: 'bch-1',
          chapterTitle: 'Real Numbers',
          chapterNumber: 1,
          bookTopics: [
            { id: 'bt-1', topicTitle: 'Introduction', topicOrder: 1 },
            { id: 'bt-2', topicTitle: "Euclid's Division Lemma", topicOrder: 2 },
          ],
        },
        {
          id: 'bch-2',
          chapterTitle: 'Polynomials',
          chapterNumber: 2,
          bookTopics: [
            { id: 'bt-3', topicTitle: 'Geometrical Meaning', topicOrder: 1 },
          ],
        },
      ],
    })

    const tx = {
      chapterDef: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(({ data }) => ({ id: `ch-${data.slug}` })) },
      topicDef: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'topic-1' }) },
      hydrationJob: { update: jest.fn().mockResolvedValue({}) },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(tx))

    await handleSyllabusJob('job-4')

    // LLM must NOT have been called
    expect(callLLM).not.toHaveBeenCalled()

    // Chapters created from PDF data
    expect(tx.chapterDef.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Real Numbers', bookChapterId: 'bch-1' }) })
    )
    expect(tx.chapterDef.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Polynomials', bookChapterId: 'bch-2' }) })
    )

    // Topics created from PDF data
    expect(tx.topicDef.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Introduction', bookTopicId: 'bt-1' }) })
    )

    // Job marked running + contentReady
    expect(tx.hydrationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contentReady: true }) })
    )
  })
})
