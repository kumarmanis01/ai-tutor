/**
 * FILE OBJECTIVE:
 * - Parse NCERT textbook PDFs to extract chapter and topic structure.
 * - Used by pdfIngestWorker to seed BookChapter/BookTopic rows.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/services/pdfParser.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | claude | created; NCERT chapter/topic parsing with exercise extraction
 */

import fs from 'fs'
import { logger } from '@/lib/logger.js'

export interface ParsedTopic {
  topicOrder: number
  topicTitle: string
  rawText: string
  exerciseText: string | null
}

export interface ParsedChapter {
  chapterNumber: number
  chapterTitle: string
  startPage: number
  endPage: number
  rawText: string
  topics: ParsedTopic[]
}

export interface PDFParseResult {
  pageCount: number
  chapters: ParsedChapter[]
  parseStrategy: string
  warnings: string[]
}

// Max chars of rawText kept per topic. ~3000 chars ≈ 750 tokens -- fits inside
// notes/questions prompt without blowing context budget.
const MAX_TOPIC_TEXT_CHARS = 12_000

// Chapter boundary patterns for NCERT books (English + Hindi)
const CHAPTER_PATTERNS = [
  /(?:^|\n)\s*Chapter\s+(\d+)\s*[\n:]\s*([^\n]{3,80})/gi,
  /(?:^|\n)\s*CHAPTER\s+(\d+)\s*[\n:]\s*([^\n]{3,80})/gi,
  /(?:^|\n)\s*अध्याय\s+(\d+)\s*[\n:]\s*([^\n]{3,80})/gi,
  /(?:^|\n)\s*पाठ\s+(\d+)\s*[\n:]\s*([^\n]{3,80})/gi,
  /(?:^|\n)\s*Unit\s+(\d+)\s*[:\-]\s*([^\n]{3,80})/gi,
]

// Numbered section heading pattern: "1.1 Title", "2.3 Some Heading"
const NUMBERED_SECTION_RE = /(?:^|\n)\s*(\d+\.\d+(?:\.\d+)?)\s+([A-Z][^\n]{4,70})\n/g

// Exercise block patterns
const EXERCISE_PATTERNS = [
  /(?:EXERCISE|Exercise|EXERCISES|Exercises)([\s\S]{20,3000}?)(?=\n\n[A-Z]|\nChapter|\nUnit|\nअध्याय|$)/gi,
  /(?:ACTIVITIES|Activities|Think\s+and\s+Discuss|INTEXT\s+QUESTIONS|IN-TEXT\s+QUESTIONS)([\s\S]{20,2000}?)(?=\n\n[A-Z]|\nChapter|\nUnit|$)/gi,
]

function extractExercises(text: string): string | null {
  const parts: string[] = []
  for (const pat of EXERCISE_PATTERNS) {
    pat.lastIndex = 0
    for (const m of text.matchAll(pat)) {
      const block = m[1]?.trim()
      if (block && block.length > 20) parts.push(block)
    }
  }
  if (parts.length === 0) return null
  return parts.join('\n\n').slice(0, 4000)
}

function extractTopicsFromChapter(chapterText: string, chapterTitle: string, _chapterNum: number): ParsedTopic[] {
  NUMBERED_SECTION_RE.lastIndex = 0
  const matches = [...chapterText.matchAll(NUMBERED_SECTION_RE)]

  if (matches.length < 2) {
    // No numbered sections -- treat full chapter text as single topic
    return [
      {
        topicOrder: 1,
        topicTitle: chapterTitle,
        rawText: chapterText.slice(0, MAX_TOPIC_TEXT_CHARS),
        exerciseText: extractExercises(chapterText),
      },
    ]
  }

  const topics: ParsedTopic[] = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const next = matches[i + 1]
    const start = m.index ?? 0
    const end = next?.index ?? chapterText.length
    const rawText = chapterText.slice(start, end).trim()

    topics.push({
      topicOrder: i + 1,
      topicTitle: m[2].trim(),
      rawText: rawText.slice(0, MAX_TOPIC_TEXT_CHARS),
      exerciseText: extractExercises(rawText),
    })
  }
  return topics
}

export async function parseNCERTBook(source: Buffer | string, _subjectType: string): Promise<PDFParseResult> {
  // Lazy import -- pdf-parse is a CJS module. Use `.default` when available (ESM interop),
  // otherwise the module itself is the function (pure CJS require).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParseRaw = await import('pdf-parse') as any
  const pdfParse = (pdfParseRaw.default ?? pdfParseRaw) as (
    buffer: Buffer,
    options?: Record<string, unknown>
  ) => Promise<{ text: string; numpages: number }>

  const buffer = typeof source === 'string' ? fs.readFileSync(source) : source
  const data = await pdfParse(buffer)

  const fullText: string = data.text
  const pageCount: number = data.numpages
  const warnings: string[] = []

  // Quality gate: scanned PDFs return very little text
  const avgCharsPerPage = fullText.length / Math.max(pageCount, 1)
  if (avgCharsPerPage < 100) {
    throw new Error(
      `PDF_PARSE_FAILED: Avg ${Math.round(avgCharsPerPage)} chars/page -- PDF appears to be scanned/image-only. OCR not supported.`
    )
  }

  // Try each chapter pattern until one yields >= 2 matches
  let chapterMatches: RegExpMatchArray[] = []
  for (const pat of CHAPTER_PATTERNS) {
    pat.lastIndex = 0
    const found = [...fullText.matchAll(pat)]
    if (found.length >= 2) {
      chapterMatches = found
      break
    }
  }

  if (chapterMatches.length === 0) {
    warnings.push('No chapter boundaries detected via standard NCERT patterns.')
    logger.warn('[pdfParser] no chapter boundaries found', { pageCount })
    throw new Error('PDF_PARSE_FAILED: No chapter boundaries detected. Ensure this is a standard NCERT textbook PDF.')
  }

  if (chapterMatches.length < 3) {
    warnings.push(`Only ${chapterMatches.length} chapters detected -- verify PDF is a complete textbook.`)
  }

  const chapters: ParsedChapter[] = []
  for (let i = 0; i < chapterMatches.length; i++) {
    const m = chapterMatches[i]
    const next = chapterMatches[i + 1]

    const chapterNum = parseInt(m[1], 10)
    const chapterTitle = m[2].trim()
    const startIdx = m.index ?? 0
    const endIdx = next?.index ?? fullText.length
    const chapterText = fullText.slice(startIdx, endIdx).trim()

    const startPage = Math.max(1, Math.floor((startIdx / fullText.length) * pageCount) + 1)
    const endPage = next
      ? Math.floor(((next.index ?? fullText.length) / fullText.length) * pageCount)
      : pageCount

    const topics = extractTopicsFromChapter(chapterText, chapterTitle, chapterNum)

    chapters.push({
      chapterNumber: chapterNum,
      chapterTitle,
      startPage,
      endPage,
      rawText: chapterText.slice(0, MAX_TOPIC_TEXT_CHARS * 3),
      topics,
    })
  }

  logger.info('[pdfParser] parsed successfully', {
    event: 'pdf_parsed',
    context: { pageCount, chapters: chapters.length, warnings },
  })

  return { pageCount, chapters, parseStrategy: _subjectType, warnings }
}
