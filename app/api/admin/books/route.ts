/**
 * FILE OBJECTIVE:
 * - GET  /api/admin/books?subjectId=xxx  list CurriculumBook rows with chapter/topic counts
 * - DELETE /api/admin/books?id=xxx       delete a book (cascades BookChapter/BookTopic,
 *                                        nullifies ChapterDef.bookChapterId + TopicDef.bookTopicId,
 *                                        deletes underlying file from R2 or local disk)
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/admin/books/books.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | claude | created; GET + DELETE handlers; deletes underlying file on DELETE
 */

import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { JobStatus } from '@/lib/ai-engine/types'
import path from 'path'
import fs from 'fs/promises'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const url = new URL(req.url)
  const subjectId = url.searchParams.get('subjectId')

  const where = subjectId ? { subjectId } : {}

  const books = await prisma.curriculumBook.findMany({
    where,
    include: {
      subject: { select: { name: true, slug: true } },
      bookChapters: {
        select: {
          id: true,
          _count: { select: { bookTopics: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = books.map((b: any ) => ({
    id: b.id,
    board: b.board,
    grade: b.grade,
    subjectId: b.subjectId,
    subjectName: b.subject.name,
    language: b.language,
    edition: b.edition,
    originalName: b.originalName,
    fileSizeBytes: b.fileSizeBytes,
    pageCount: b.pageCount,
    parseStatus: b.parseStatus,
    parseError: b.parseError,
    parsedAt: b.parsedAt,
    uploadedBy: b.uploadedBy,
    createdAt: b.createdAt,
    chapterCount: b.bookChapters.length,
    topicCount: b.bookChapters.reduce((sum: any, ch: any) => sum + ch._count.bookTopics, 0),
  }))

  return NextResponse.json(rows)
}

export async function DELETE(req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const book = await prisma.curriculumBook.findUnique({
    where: { id },
    select: { id: true, subjectId: true, storagePath: true },
  })
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  // Guard: block delete if a hydration job is actively running for this subject
  const activeJob = await prisma.hydrationJob.findFirst({
    where: {
      subjectId: book.subjectId,
      hierarchyLevel: 0,
      status: { in: [JobStatus.Pending, JobStatus.Running] },
    },
    select: { id: true, status: true },
  })
  if (activeJob) {
    return NextResponse.json(
      { error: `Cannot delete: hydration job ${activeJob.id} is ${activeJob.status} for this subject.` },
      { status: 409 }
    )
  }

  // Nullify ChapterDef.bookChapterId links before cascade delete
  await prisma.chapterDef.updateMany({
    where: { bookChapter: { bookId: id } },
    data: { bookChapterId: null },
  })

  // Nullify TopicDef.bookTopicId links
  const bookChapterIds = (
    await prisma.bookChapter.findMany({ where: { bookId: id }, select: { id: true } })
  ).map((ch: any ) => ch.id)

  if (bookChapterIds.length > 0) {
    await prisma.topicDef.updateMany({
      where: { bookTopic: { chapterId: { in: bookChapterIds } } },
      data: { bookTopicId: null },
    })
  }

  // Delete book row (cascades to BookChapter and BookTopic)
  await prisma.curriculumBook.delete({ where: { id } })

  // Delete underlying file from R2 or local disk (best-effort -- log but don't fail the request)
  await deleteStorageFile(book.storagePath, id)

  logger.info('[books/delete] deleted', {
    event: 'book_deleted',
    context: { bookId: id, subjectId: book.subjectId, userId: session.user.id },
  })

  return NextResponse.json({ ok: true })
}

async function deleteStorageFile(storagePath: string, bookId: string): Promise<void> {
  const isR2Key = !path.isAbsolute(storagePath)
  if (isR2Key) {
    const useR2 = !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ENDPOINT)
    if (useR2) {
      try {
        const { deleteFromR2 } = await import('@/lib/storage/r2')
        await deleteFromR2(storagePath)
      } catch (err) {
        logger.error('[books/delete] R2 file deletion failed', { bookId, storagePath, error: String(err) })
      }
    }
  } else {
    try {
      await fs.unlink(storagePath)
    } catch (err) {
      logger.error('[books/delete] local file deletion failed', { bookId, storagePath, error: String(err) })
    }
  }
}
