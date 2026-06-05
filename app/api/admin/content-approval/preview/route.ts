/**
 * GET /api/admin/content-approval/preview?type=<type>&id=<id>
 * Returns the full content for admin preview before approve/reject.
 * Auth: admin role required.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers()
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  const type = req.nextUrl.searchParams.get('type')
  const id = req.nextUrl.searchParams.get('id')

  if (!type || !id) {
    return NextResponse.json({ error: 'type and id are required' }, { status: 400 })
  }

  try {
    switch (type) {
      case 'chapter': {
        const chapter = await prisma.chapterDef.findUnique({
          where: { id },
          include: {
            subject: {
              include: { class: { include: { board: true } } },
            },
            topics: {
              where: { lifecycle: 'active' },
              orderBy: { order: 'asc' },
              select: { id: true, name: true, status: true },
            },
          },
        })
        if (!chapter) return NextResponse.json({ error: 'not_found' }, { status: 404 })
        return NextResponse.json({
          type: 'chapter',
          title: chapter.name,
          subject: chapter.subject.name,
          board: chapter.subject.class.board.name,
          grade: chapter.subject.class.grade,
          status: chapter.status,
          topics: chapter.topics.map((t: any ) => ({ name: t.name, status: t.status })),
        })
      }

      case 'topic': {
        const topic = await prisma.topicDef.findUnique({
          where: { id },
          include: {
            chapter: {
              include: {
                subject: { include: { class: { include: { board: true } } } },
              },
            },
            notes: {
              where: { lifecycle: 'active' },
              select: { id: true, title: true, language: true, status: true },
            },
          },
        })
        if (!topic) return NextResponse.json({ error: 'not_found' }, { status: 404 })
        return NextResponse.json({
          type: 'topic',
          title: topic.name,
          subject: topic.chapter.subject.name,
          chapter: topic.chapter.name,
          board: topic.chapter.subject.class.board.name,
          grade: topic.chapter.subject.class.grade,
          status: topic.status,
          notes: topic.notes.map((n: any ) => ({ title: n.title, language: n.language, status: n.status })),
        })
      }

      case 'note': {
        const note = await prisma.topicNote.findUnique({
          where: { id },
          include: {
            topic: {
              include: {
                chapter: {
                  include: {
                    subject: { include: { class: { include: { board: true } } } },
                  },
                },
              },
            },
          },
        })
        if (!note) return NextResponse.json({ error: 'not_found' }, { status: 404 })
        return NextResponse.json({
          type: 'note',
          title: note.title,
          topic: note.topic.name,
          chapter: note.topic.chapter.name,
          subject: note.topic.chapter.subject.name,
          board: note.topic.chapter.subject.class.board.name,
          grade: note.topic.chapter.subject.class.grade,
          language: note.language,
          status: note.status,
          contentJson: note.contentJson,
        })
      }

      case 'test': {
        const test = await prisma.generatedTest.findUnique({
          where: { id },
          include: {
            topic: {
              include: {
                chapter: {
                  include: {
                    subject: { include: { class: { include: { board: true } } } },
                  },
                },
              },
            },
            questions: {
              orderBy: { id: 'asc' },
              select: {
                id: true,
                type: true,
                question: true,
                options: true,
                answer: true,
                explanation: true,
              },
            },
          },
        })
        if (!test) return NextResponse.json({ error: 'not_found' }, { status: 404 })
        return NextResponse.json({
          type: 'test',
          title: test.title,
          topic: test.topic.name,
          chapter: test.topic.chapter.name,
          subject: test.topic.chapter.subject.name,
          board: test.topic.chapter.subject.class.board.name,
          grade: test.topic.chapter.subject.class.grade,
          difficulty: test.difficulty,
          language: test.language,
          status: test.status,
          questions: test.questions,
        })
      }

      default:
        return NextResponse.json({ error: 'unsupported type' }, { status: 400 })
    }
  } catch (err) {
    logger.error('GET /api/admin/content-approval/preview error', { err })
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
