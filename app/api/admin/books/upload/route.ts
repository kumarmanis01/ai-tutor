/**
 * POST /api/admin/books/upload
 *
 * Accepts a multipart/form-data PDF upload for an NCERT textbook.
 * Saves the file, creates a CurriculumBook row, and enqueues a pdf-ingest job.
 *
 * Fields:
 *   file      (File)    -- PDF, max 50MB
 *   subjectId (string)  -- SubjectDef.id
 *   language  (string)  -- 'en' | 'hi', default 'en'
 *   edition   (string)  -- optional, e.g. "2024-25"
 *
 * Returns 202: { ok: true, bookId, message }
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPdfIngestQueue } from '@/queues/contentQueue'
import { logger } from '@/lib/logger'
import fs from 'fs/promises'
import path from 'path'
import { uploadBufferToR2 } from '@/lib/storage/r2'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50MB

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
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

  // Save file: use R2 if configured, else local disk
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
    // Local fallback
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'books')
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
        parseStatus: 'pending',
        uploadedBy: session.user.id,
      },
      select: { id: true },
    })
  } catch (err) {
    logger.error('[books/upload] DB create failed', { subjectId, error: String(err) })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Enqueue pdf-ingest job
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
    // Non-fatal: mark the book as failed so admin can retry
    logger.error('[books/upload] queue enqueue failed', { bookId: book.id, error: String(err) })
    await prisma.curriculumBook.update({
      where: { id: book.id },
      data: { parseStatus: 'failed', parseError: 'Queue unavailable -- retry parse via admin panel' },
    }).catch(() => {})
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
