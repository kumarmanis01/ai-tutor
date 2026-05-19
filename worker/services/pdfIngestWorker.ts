/**
 * PDF ingest worker -- processes uploaded NCERT textbook PDFs.
 *
 * Flow:
 *  1. Marks CurriculumBook as 'parsing'
 *  2. Calls pdfParser to extract chapters + topics
 *  3. Persists BookChapter + BookTopic rows (idempotent)
 *  4. Marks CurriculumBook as 'parsed'
 *  5. Triggers a HydrationJob (syllabus type) via Outbox so the
 *     SyllabusWorker can pick up the PDF-seeded structure instead of
 *     asking the LLM to recall it.
 *
 * The worker does NOT delete existing ChapterDef/TopicDef rows. The
 * SyllabusWorker's PDF-first path handles upserts idempotently.
 */

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

export async function processPdfIngestJob(payload: PdfIngestJobPayload): Promise<void> {
  const { bookId, subjectId, filePath, subjectType, language, uploadedBy } = payload

  logger.info('[pdfIngest] starting', { event: 'pdf_ingest_start', context: { bookId, subjectId } })

  // 1. Claim: mark as parsing
  const claimed = await prisma.curriculumBook.updateMany({
    where: { id: bookId, parseStatus: { in: ['pending', 'failed'] } },
    data: { parseStatus: 'parsing', parseError: null },
  })
  if (claimed.count === 0) {
    // Already being parsed or already parsed -- skip
    logger.warn('[pdfIngest] skipping: already parsing or parsed', { bookId })
    return
  }

  try {
    // 2. Parse
    const result = await parseNCERTBook(filePath, subjectType)

    logger.info('[pdfIngest] pdf parsed', {
      event: 'pdf_parsed',
      context: { bookId, chapters: result.chapters.length, warnings: result.warnings },
    })

    // 3. Persist BookChapter + BookTopic rows (idempotent upserts)
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

      // Delete old topics before re-creating (idempotent re-parse)
      await prisma.bookTopic.deleteMany({ where: { chapterId: bookChapter.id } })

      if (ch.topics.length > 0) {
        await prisma.bookTopic.createMany({
          data: ch.topics.map(t => ({
            chapterId: bookChapter.id,
            topicOrder: t.topicOrder,
            topicTitle: t.topicTitle,
            rawText: t.rawText,
            exerciseText: t.exerciseText ?? null,
          })),
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
          // No validation caps for PDF-anchored hydration -- structure comes from PDF
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
