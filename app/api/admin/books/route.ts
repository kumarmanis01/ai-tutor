/**
 * GET  /api/admin/books?subjectId=xxx  -- list books with chapter/topic counts
 * DELETE /api/admin/books?id=xxx       -- delete a book (cascades BookChapter/BookTopic,
 *                                         nullifies ChapterDef.bookChapterId + TopicDef.bookTopicId)
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { JobStatus } from '@prisma/client'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
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

  const rows = books.map(b => ({
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
    topicCount: b.bookChapters.reduce((sum, ch) => sum + ch._count.bookTopics, 0),
  }))

  return NextResponse.json(rows)
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
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
    select: { id: true, subjectId: true },
  })
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  // Guard: block delete if a hydration job is actively running for this subject
  const activeJob = await prisma.hydrationJob.findFirst({
    where: {
      subjectId: book.subjectId,
      hierarchyLevel: 0,
      status: { in: [JobStatus.pending, JobStatus.running] },
    },
    select: { id: true, status: true },
  })
  if (activeJob) {
    return NextResponse.json(
      { error: `Cannot delete: hydration job ${activeJob.id} is ${activeJob.status} for this subject.` },
      { status: 409 }
    )
  }

  // Nullify ChapterDef.bookChapterId and TopicDef.bookTopicId links before cascade delete
  // (FK is SET NULL on the DB side, but be explicit for clarity)
  await prisma.chapterDef.updateMany({
    where: {
      bookChapter: { bookId: id },
    },
    data: { bookChapterId: null },
  })

  // TopicDef links are nullified via the chapterDef cascade or direct update
  const bookChapterIds = (
    await prisma.bookChapter.findMany({ where: { bookId: id }, select: { id: true } })
  ).map(ch => ch.id)

  if (bookChapterIds.length > 0) {
    await prisma.topicDef.updateMany({
      where: { bookTopic: { chapterId: { in: bookChapterIds } } },
      data: { bookTopicId: null },
    })
  }

  // Delete book (cascades to BookChapter and BookTopic via onDelete: Cascade)
  await prisma.curriculumBook.delete({ where: { id } })

  logger.info('[books/delete] deleted', {
    event: 'book_deleted',
    context: { bookId: id, subjectId: book.subjectId, userId: session.user.id },
  })

  return NextResponse.json({ ok: true })
}
