/**
 * FILE OBJECTIVE:
 * - BullMQ worker handler that processes uploaded NCERT textbook PDFs.
 * - Downloads file from R2 (or reads from local path), parses chapters/topics,
 *   persists to BookChapter/BookTopic via idempotent upserts, then triggers a
 *   HydrationJob so SyllabusWorker can seed from PDF structure.
 *
 * LINKED UNIT TEST:
 * - tests/unit/worker/services/pdfIngestWorker.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | claude | created; idempotent upserts for BookTopic; R2 download support
 */

import path from 'path'
import { prisma } from '@/lib/prisma.js'
import { parseNCERTBook } from '@/lib/services/pdfParser.js'
import { logger } from '@/lib/logger.js'
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants.js'
import { JobStatus } from '@/lib/ai-engine/types'
import { JobType, DifficultyLevel, LanguageCode } from '@prisma/client'

export interface PdfIngestJobPayload {
  bookId: string
  subjectId: string
  filePath: string
  subjectType: string
  language: string
  uploadedBy: string
}

// Returns true when filePath is an R2 object key (no leading slash, no drive letter on Windows)
function isR2Key(filePath: string): boolean {
  return !path.isAbsolute(filePath)
}

async function resolveBuffer(filePath: string): Promise<Buffer> {
  if (isR2Key(filePath)) {
    const { downloadBufferFromR2 } = await import('@/lib/storage/r2.js')
    return downloadBufferFromR2(filePath)
  }
  const fs = await import('fs/promises')
  return fs.readFile(filePath)
}

export async function processPdfIngestJob(payload: PdfIngestJobPayload): Promise<void> {
  const { bookId, subjectId, filePath, subjectType, language, uploadedBy } = payload

  logger.info('[pdfIngest] starting', { event: 'pdf_ingest_start', context: { bookId, subjectId } })

  // 1. Claim: mark as parsing (idempotent -- skip if already claimed or done)
  const claimed = await prisma.curriculumBook.updateMany({
    where: { id: bookId, parseStatus: { in: ['pending', 'failed'] } },
    data: { parseStatus: 'parsing', parseError: null },
  })
  if (claimed.count === 0) {
    logger.warn('[pdfIngest] skipping: already parsing or parsed', { bookId })
    return
  }

  try {
    // 2. Download from R2 or read from local disk, then parse
    const buffer = await resolveBuffer(filePath)
    const result = await parseNCERTBook(buffer, subjectType)

    logger.info('[pdfIngest] pdf parsed', {
      event: 'pdf_parsed',
      context: { bookId, chapters: result.chapters.length, warnings: result.warnings },
    })

    // 3. Persist BookChapter + BookTopic rows (fully idempotent upserts)
    for (const ch of result.chapters) {
      const bookChapter = await prisma.bookChapter.upsert({
        where: { bookId_chapterNumber: { bookId, chapterNumber: ch.chapterNumber } },
        update: {
          chapterTitle: ch.chapterTitle,
          startPage: ch.startPage,
          endPage: ch.endPage,
          rawText: ch.rawText,
        },
        create: {
          bookId,
          chapterNumber: ch.chapterNumber,
          chapterTitle: ch.chapterTitle,
          startPage: ch.startPage,
          endPage: ch.endPage,
          rawText: ch.rawText,
        },
      })

      // Upsert each topic by (chapterId, topicOrder) -- safe on re-parse without breaking FK links
      for (const t of ch.topics) {
        await prisma.bookTopic.upsert({
          where: { chapterId_topicOrder: { chapterId: bookChapter.id, topicOrder: t.topicOrder } },
          update: {
            topicTitle: t.topicTitle,
            rawText: t.rawText,
            exerciseText: t.exerciseText ?? null,
          },
          create: {
            chapterId: bookChapter.id,
            topicOrder: t.topicOrder,
            topicTitle: t.topicTitle,
            rawText: t.rawText,
            exerciseText: t.exerciseText ?? null,
          },
        })
      }
    }

    // 4. Mark parsed
    await prisma.curriculumBook.update({
      where: { id: bookId },
      data: {
        parseStatus: 'parsed',
        pageCount: result.pageCount,
        parsedAt: new Date(),
        parseError: null,
      },
    })

    // 5. Trigger HydrateAll for this subject via HydrationJob + Outbox
    await triggerHydration({ bookId, subjectId, language, uploadedBy })

    logger.info('[pdfIngest] complete', {
      event: 'pdf_ingest_complete',
      context: { bookId, chapters: result.chapters.length },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[pdfIngest] failed', { event: 'pdf_ingest_failed', context: { bookId, error: message } })

    await prisma.curriculumBook.update({
      where: { id: bookId },
      data: { parseStatus: 'failed', parseError: message },
    })
    throw err
  }
}

async function triggerHydration(params: {
  bookId: string
  subjectId: string
  language: string
  uploadedBy: string
}): Promise<void> {
  const { subjectId, language, uploadedBy } = params

  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    include: { class: { include: { board: true } } },
  })
  if (!subject) {
    logger.warn('[pdfIngest] subject not found -- skipping hydration trigger', { subjectId })
    return
  }

  const boardCode = subject.class.board.slug ?? subject.class.board.name
  const grade = subject.class.grade
  const langCode = (language === 'hi' ? 'hi' : 'en') as LanguageCode

  // Check if a pending/running root hydration job already exists for this subject
  const existing = await prisma.hydrationJob.findFirst({
    where: {
      subjectId,
      hierarchyLevel: 0,
      status: { in: [JobStatus.Pending, JobStatus.Running] },
    },
  })
  if (existing) {
    logger.info('[pdfIngest] hydration job already active -- skipping duplicate trigger', {
      subjectId,
      existingJobId: existing.id,
    })
    return
  }

  await prisma.$transaction(async tx => {
    const rootJob = await tx.hydrationJob.create({
      data: {
        jobType: JobType.syllabus,
        board: boardCode,
        grade,
        subject: subject.slug,
        subjectId,
        rootJobId: null,
        parentJobId: null,
        language: langCode,
        difficulty: DifficultyLevel.medium,
        status: JobStatus.Pending,
        attempts: 0,
        maxAttempts: 3,
        contentReady: false,
        chaptersExpected: 0,
        chaptersCompleted: 0,
        topicsExpected: 0,
        topicsCompleted: 0,
        notesExpected: 0,
        notesCompleted: 0,
        questionsExpected: 0,
        questionsCompleted: 0,
        estimatedCostUsd: null,
        actualCostUsd: 0,
        inputParams: {
          language: langCode,
          boardCode,
          grade,
          subjectCode: subject.slug,
          subjectId,
          triggeredBy: 'pdf_ingest',
          triggeredByUserId: uploadedBy,
          generationLimits: {
            validationRun: false,
            safeMode: false,
            chaptersLimit: 0,
            topicsPerChapterLimit: 0,
          },
        },
      },
    })

    await tx.outbox.create({
      data: {
        queue: CONTENT_HYDRATION_QUEUE,
        payload: {
          type: 'SYLLABUS',
          payload: { jobId: rootJob.id },
        },
        meta: {
          hydrationJobId: rootJob.id,
          subjectId,
          language: langCode,
          boardCode,
          grade,
          subjectCode: subject.slug,
          triggeredBy: 'pdf_ingest',
          userId: uploadedBy,
        },
      },
    })

    logger.info('[pdfIngest] hydration job enqueued', {
      event: 'hydration_triggered',
      context: { subjectId, rootJobId: rootJob.id },
    })
  })
}
