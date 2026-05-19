/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/services/pdfParser.ts -- chapter/topic extraction logic.
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

// Mock pdf-parse so tests don't require a real PDF file.
// The CJS/ESM interop in pdfParser uses `.default ?? module`, so we expose the mock fn as `.default`.
const mockPdfParseFn = jest.fn()
jest.mock('pdf-parse', () => {
  const fn = mockPdfParseFn
  fn.default = fn
  return fn
})

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('fs', () => ({ readFileSync: jest.fn().mockReturnValue(Buffer.alloc(0)) }))

import { parseNCERTBook } from '@/lib/services/pdfParser'

const pdfParseMock = mockPdfParseFn

const CHAPTER_TEXT = `
Chapter 1
The Real Numbers
1.1 Introduction
Real numbers include both rational and irrational numbers.
All numbers on the number line are real.
1.2 Euclid's Division Lemma
Given positive integers a and b there exist unique integers q and r.
`

describe('parseNCERTBook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should throw when PDF is scanned (low avg chars per page)', async () => {
    pdfParseMock.mockResolvedValue({ text: 'AB', numpages: 100 })

    await expect(parseNCERTBook(Buffer.alloc(0), 'mathematics')).rejects.toThrow('PDF_PARSE_FAILED')
  })

  test('should throw when no chapter boundaries detected', async () => {
    pdfParseMock.mockResolvedValue({
      text: 'a'.repeat(10000),
      numpages: 10,
    })

    await expect(parseNCERTBook(Buffer.alloc(0), 'mathematics')).rejects.toThrow(
      'No chapter boundaries detected'
    )
  })

  test('should parse chapters and topics from well-formed NCERT text', async () => {
    const chapter1 = CHAPTER_TEXT.repeat(15)
    const chapter2 = '\nChapter 2\nPolynomials\n2.1 Introduction\nA polynomial is an expression involving variables.\n2.2 Geometrical Meaning\nThe zeroes of a polynomial represent x-intercepts.\n'.repeat(10)
    const fullText = chapter1 + chapter2
    pdfParseMock.mockResolvedValue({ text: fullText, numpages: 40 })

    const result = await parseNCERTBook(Buffer.alloc(0), 'mathematics')

    expect(result.pageCount).toBe(40)
    expect(result.chapters.length).toBeGreaterThanOrEqual(2)
    expect(result.chapters[0].chapterNumber).toBe(1)
    expect(result.chapters[0].chapterTitle).toBeTruthy()
    expect(result.chapters[0].topics.length).toBeGreaterThanOrEqual(1)
    expect(result.warnings).toBeInstanceOf(Array)
  })

  test('should accept a file path string and read via fs.readFileSync', async () => {
    const fullText =
      '\nChapter 1\nNumbers\n1.1 Integers\nAn integer is any whole number number number number number number.\n'.repeat(30) +
      '\nChapter 2\nAlgebra\n2.1 Variables\nA variable represents an unknown quantity in an expression.\n'.repeat(20)
    pdfParseMock.mockResolvedValue({ text: fullText, numpages: 10 })

    const result = await parseNCERTBook('/fake/path/book.pdf', 'mathematics')

    const fsModule = jest.requireMock('fs')
    expect(fsModule.readFileSync).toHaveBeenCalledWith('/fake/path/book.pdf')
    expect(result.chapters.length).toBeGreaterThanOrEqual(2)
  })

  test('should fall back to full-chapter topic when no numbered sections found', async () => {
    const fullText =
      '\nChapter 1\nIntroduction\nThis chapter has no numbered subsections.\n'.repeat(30) +
      '\nChapter 2\nConclusion\nFinal chapter text.\n'.repeat(10)
    pdfParseMock.mockResolvedValue({ text: fullText, numpages: 10 })

    const result = await parseNCERTBook(Buffer.alloc(0), 'general')

    expect(result.chapters[0].topics).toHaveLength(1)
    expect(result.chapters[0].topics[0].topicOrder).toBe(1)
  })
})
