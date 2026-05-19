/**
 * POST /api/admin/books/retry
 * Body: { bookId: string }
 *
 * Re-enqueues a failed CurriculumBook parse job.
 * Only valid when parseStatus === 'failed'.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPdfIngestQueue } from '@/queues/contentQueue'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let body: { bookId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { bookId } = body
  if (!bookId) {
    return NextResponse.json({ error: 'bookId is required' }, { status: 400 })
  }

  const book = await prisma.curriculumBook.findUnique({
    where: { id: bookId },
    include: { subject: { select: { name: true, slug: true } } },
  })
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }
  if (book.parseStatus !== 'failed') {
    return NextResponse.json(
      { error: `Cannot retry: current status is '${book.parseStatus}'` },
      { status: 409 }
    )
  }

  // Reset status so the worker can claim it
  await prisma.curriculumBook.update({
    where: { id: bookId },
    data: { parseStatus: 'pending', parseError: null },
  })

  const subjectType = deriveSubjectType(book.subject.name)
  const queue = getPdfIngestQueue()
  await queue.add(
    `pdf-ingest-${bookId}-retry`,
    {
      bookId,
      subjectId: book.subjectId,
      filePath: book.storagePath,
      subjectType,
      language: book.language,
      uploadedBy: session.user.id,
    }
  )

  logger.info('[books/retry] re-enqueued', {
    event: 'book_retry',
    context: { bookId, subjectId: book.subjectId, userId: session.user.id },
  })

  return NextResponse.json({ ok: true, message: 'Parse job re-enqueued.' })
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
