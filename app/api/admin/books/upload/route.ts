/**
 * FILE OBJECTIVE:
 * - Accept multipart PDF upload for NCERT textbook, persist to R2 or local disk,
 *   create CurriculumBook row, and enqueue a pdf-ingest BullMQ job.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/admin/books/upload.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | claude | created; R2 or local upload, enqueue pdf-ingest job
 *
 * Required env vars (add to .env / .env.production):
 *   R2_ACCESS_KEY_ID      -- R2 HMAC key ID (optional; local fallback used if absent)
 *   R2_SECRET_ACCESS_KEY  -- R2 HMAC secret
 *   R2_ENDPOINT           -- e.g. https://<account>.r2.cloudflarestorage.com
 *   R2_BUCKET             -- R2 bucket name
 *   R2_REGION             -- default 'auto'
 *   R2_PUBLIC_URL         -- optional CDN prefix for public download links
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getPdfIngestQueue } from '@/queues/contentQueue'
import { logger } from '@/lib/logger'
import { CurriculumBookParseStatus } from '@prisma/client'
import fs from 'fs/promises'
import path from 'path'
import { uploadBufferToR2 } from '@/lib/storage/r2'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50MB

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart request' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const subjectId = (formData.get('subjectId') as string | null)?.trim()
  const language = ((formData.get('language') as string | null)?.trim() || 'en')
  const edition = (formData.get('edition') as string | null)?.trim() || null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!subjectId) {
    return NextResponse.json({ error: 'subjectId is required' }, { status: 400 })
  }
  if (!['en', 'hi'].includes(language)) {
    return NextResponse.json({ error: `Invalid language: ${language}` }, { status: 400 })
  }

  // Validate content type
  const contentType = file.type || ''
  if (!contentType.includes('pdf') && !file.name?.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 415 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (buffer.length > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 413 })
  }

  // Verify subject exists and get board+grade for denormalization
  const subject = await prisma.subjectDef.findUnique({
    where: { id: subjectId },
    include: { class: { include: { board: true } } },
  })
  if (!subject) {
    return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
  }

  // Check for existing book (unique per subjectId+language)
  const existing = await prisma.curriculumBook.findFirst({
    where: { subjectId, language },
  })
  if (existing) {
    return NextResponse.json(
      {
        error: `A book already exists for this subject+language (id: ${existing.id}, status: ${existing.parseStatus}). Delete it first to re-upload.`,
      },
      { status: 409 }
    )
  }

  const board = subject.class.board.slug ?? subject.class.board.name
  const grade = subject.class.grade
  const originalName = file.name ?? `textbook-${Date.now()}.pdf`

  // Save file: use R2 if configured, else write outside public/ so PDFs are not world-accessible
  let storagePath: string
  const useR2 = !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ENDPOINT)

  if (useR2) {
    const key = `books/${board}-${grade}-${subject.slug}-${language}-${Date.now()}.pdf`
    try {
      await uploadBufferToR2(buffer, key, 'application/pdf')
      storagePath = key
    } catch (err) {
      logger.error('[books/upload] R2 upload failed', { subjectId, error: String(err) })
      return NextResponse.json({ error: 'File storage failed' }, { status: 500 })
    }
  } else {
    // Local fallback -- store outside public/ so files are not web-accessible
    const uploadDir = path.join(process.cwd(), 'uploads', 'books')
    try {
      await fs.mkdir(uploadDir, { recursive: true })
    } catch {
      return NextResponse.json({ error: 'Failed to create upload directory' }, { status: 500 })
    }
    const filename = `${board}-${grade}-${subject.slug}-${language}-${Date.now()}.pdf`
    const filePath = path.join(uploadDir, filename)
    try {
      await fs.writeFile(filePath, buffer)
    } catch (err) {
      logger.error('[books/upload] local write failed', { subjectId, error: String(err) })
      return NextResponse.json({ error: 'File storage failed' }, { status: 500 })
    }
    storagePath = filePath
  }

  // Create CurriculumBook row
  let book: { id: string }
  try {
    book = await prisma.curriculumBook.create({
      data: {
        board,
        grade,
        subjectId,
        language,
        edition: edition || null,
        originalName,
        storagePath,
        fileSizeBytes: buffer.length,
        parseStatus: CurriculumBookParseStatus.pending,
        uploadedBy: session.user.id,
      },
      select: { id: true },
    })
  } catch (err) {
    logger.error('[books/upload] DB create failed', { subjectId, error: String(err) })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Enqueue pdf-ingest job (non-fatal if queue unavailable -- admin can retry)
  const subjectType = deriveSubjectType(subject.name)
  try {
    const queue = getPdfIngestQueue()
    await queue.add(
      `pdf-ingest-${book.id}`,
      {
        bookId: book.id,
        subjectId,
        filePath: storagePath,
        subjectType,
        language,
        uploadedBy: session.user.id,
      },
      { jobId: book.id }
    )
  } catch (err) {
    logger.error('[books/upload] queue enqueue failed -- book marked failed for retry', {
      bookId: book.id,
      error: String(err),
    })
    await prisma.curriculumBook.update({
      where: { id: book.id },
      data: { parseStatus: CurriculumBookParseStatus.failed, parseError: 'Queue unavailable -- retry parse via admin panel' },
    }).catch(dbErr => {
      logger.error('[books/upload] failed to mark book as failed after queue error', { bookId: book.id, error: String(dbErr) })
    })
  }

  logger.info('[books/upload] uploaded', {
    event: 'book_uploaded',
    context: { bookId: book.id, subjectId, board, grade, language, bytes: buffer.length },
  })

  return NextResponse.json(
    {
      ok: true,
      bookId: book.id,
      message: 'PDF uploaded. Parsing will begin shortly.',
    },
    { status: 202 }
  )
}

function deriveSubjectType(subjectName: string): string {
  const n = subjectName.toLowerCase()
  if (n.includes('math')) return 'mathematics'
  if (n.includes('science') || n.includes('physics') || n.includes('chemistry') || n.includes('biology')) {
    return 'science'
  }
  if (n.includes('history') || n.includes('geography') || n.includes('civics') || n.includes('social')) {
    return 'social_science'
  }
  if (n.includes('hindi') || n.includes('english') || n.includes('language')) return 'language'
  return 'general'
}
