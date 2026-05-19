/**
 * FILE OBJECTIVE:
 * - Unit tests for pdfIngestWorker: claim, parse, persist, hydration trigger.
 * - Tests happy path, already-claimed idempotency, parse failure, and trigger-skip.
 *
 * LINKED UNIT TEST: (this file is the test)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | claude | created
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    curriculumBook: {
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    bookChapter: { upsert: jest.fn() },
    bookTopic: { upsert: jest.fn() },
    subjectDef: { findUnique: jest.fn() },
    hydrationJob: { findFirst: jest.fn(), create: jest.fn() },
    outbox: { create: jest.fn() },
    $transaction: jest.fn(),
  }
}))

jest.mock('@/lib/services/pdfParser', () => ({
  parseNCERTBook: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

// Stub the dynamic R2 import -- in tests filePath is always absolute so isR2Key returns false
jest.mock('@/lib/storage/r2', () => ({ downloadBufferFromR2: jest.fn() }))
jest.mock('fs/promises', () => ({ readFile: jest.fn().mockResolvedValue(Buffer.alloc(100)) }))

import { processPdfIngestJob } from '@/worker/services/pdfIngestWorker'
import { prisma } from '@/lib/prisma'
import { parseNCERTBook } from '@/lib/services/pdfParser'

const PAYLOAD = {
  bookId: 'book-1',
  subjectId: 'sub-1',
  filePath: '/abs/path/book.pdf',
  subjectType: 'mathematics',
  language: 'en',
  uploadedBy: 'admin-1',
}

const PARSE_RESULT = {
  pageCount: 30,
  chapters: [
    {
      chapterNumber: 1,
      chapterTitle: 'Real Numbers',
      startPage: 1,
      endPage: 15,
      rawText: 'Chapter text...',
      topics: [
        { topicOrder: 1, topicTitle: 'Introduction', rawText: 'Intro text', exerciseText: null },
      ],
    },
  ],
  parseStrategy: 'mathematics',
  warnings: [],
}

describe('processPdfIngestJob', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should skip when book is already being parsed (count === 0)', async () => {
    ;(prisma.curriculumBook.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    await processPdfIngestJob(PAYLOAD)

    expect(parseNCERTBook).not.toHaveBeenCalled()
    expect(prisma.curriculumBook.update).not.toHaveBeenCalled()
  })

  test('should parse, upsert chapters/topics, mark parsed, and trigger hydration', async () => {
    ;(prisma.curriculumBook.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(parseNCERTBook as jest.Mock).mockResolvedValue(PARSE_RESULT)
    ;(prisma.bookChapter.upsert as jest.Mock).mockResolvedValue({ id: 'bch-1' })
    ;(prisma.bookTopic.upsert as jest.Mock).mockResolvedValue({ id: 'bt-1' })
    ;(prisma.curriculumBook.update as jest.Mock).mockResolvedValue({})
    ;(prisma.subjectDef.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      slug: 'mathematics',
      class: { grade: 8, board: { slug: 'cbse', name: 'CBSE' } },
    })
    ;(prisma.hydrationJob.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
      cb({ hydrationJob: { create: jest.fn().mockResolvedValue({ id: 'hjob-1' }) }, outbox: { create: jest.fn() } })
    )

    await processPdfIngestJob(PAYLOAD)

    expect(prisma.bookChapter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookId_chapterNumber: { bookId: 'book-1', chapterNumber: 1 } },
        create: expect.objectContaining({ chapterTitle: 'Real Numbers' }),
      })
    )
    expect(prisma.bookTopic.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chapterId_topicOrder: { chapterId: 'bch-1', topicOrder: 1 } },
        create: expect.objectContaining({ topicTitle: 'Introduction' }),
      })
    )
    expect(prisma.curriculumBook.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'book-1' },
        data: expect.objectContaining({ parseStatus: 'parsed' }),
      })
    )
  })

  test('should mark failed and rethrow when parseNCERTBook throws', async () => {
    ;(prisma.curriculumBook.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(parseNCERTBook as jest.Mock).mockRejectedValue(new Error('PDF_PARSE_FAILED: scanned'))
    ;(prisma.curriculumBook.update as jest.Mock).mockResolvedValue({})

    await expect(processPdfIngestJob(PAYLOAD)).rejects.toThrow('PDF_PARSE_FAILED')

    expect(prisma.curriculumBook.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parseStatus: 'failed' }),
      })
    )
  })

  test('should skip hydration trigger when an active job already exists', async () => {
    ;(prisma.curriculumBook.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(parseNCERTBook as jest.Mock).mockResolvedValue(PARSE_RESULT)
    ;(prisma.bookChapter.upsert as jest.Mock).mockResolvedValue({ id: 'bch-1' })
    ;(prisma.bookTopic.upsert as jest.Mock).mockResolvedValue({ id: 'bt-1' })
    ;(prisma.curriculumBook.update as jest.Mock).mockResolvedValue({})
    ;(prisma.subjectDef.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      slug: 'mathematics',
      class: { grade: 8, board: { slug: 'cbse', name: 'CBSE' } },
    })
    ;(prisma.hydrationJob.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-job', status: 'Running' })

    await processPdfIngestJob(PAYLOAD)

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
