/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch detailed content for admin review before approval.
 * - Returns full content (notes, test questions, syllabus chapters, etc.) for the detail modal.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content-approval/[type]/[id]/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-23T00:00:00Z | copilot | Created endpoint for content detail fetching
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';

type ContentType = 'syllabus' | 'chapter' | 'topic' | 'note' | 'test';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { type, id } = await params;
    const contentType = type as ContentType;

    let result: unknown = null;

    switch (contentType) {
      case 'note': {
        const note = await prisma.topicNote.findUnique({
          where: { id },
          include: {
            topic: {
              include: {
                chapter: {
                  include: {
                    subject: true,
                  },
                },
              },
            },
          },
        });

        if (!note) {
          return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        result = {
          id: note.id,
          type: 'note',
          title: note.title,
          contentJson: note.contentJson,
          metadata: {
            language: note.language,
            version: note.version,
            status: note.status,
            topicName: note.topic?.name,
            chapterName: note.topic?.chapter?.name,
            subjectName: note.topic?.chapter?.subject?.name,
          },
        };
        break;
      }

      case 'test': {
        const test = await prisma.generatedTest.findUnique({
          where: { id },
          include: {
            questions: true,
            topic: {
              include: {
                chapter: {
                  include: {
                    subject: true,
                  },
                },
              },
            },
          },
        });

        if (!test) {
          return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        result = {
          id: test.id,
          type: 'test',
          title: test.title,
          questions: test.questions.map((q) => ({
            id: q.id,
            type: q.type,
            question: q.question,
            options: q.options,
            answer: q.answer,
            marks: q.marks,
          })),
          metadata: {
            difficulty: test.difficulty,
            language: test.language,
            version: test.version,
            status: test.status,
            questionCount: test.questions.length,
            topicName: test.topic?.name,
            chapterName: test.topic?.chapter?.name,
            subjectName: test.topic?.chapter?.subject?.name,
          },
        };
        break;
      }

      case 'syllabus': {
        const syllabus = await prisma.syllabusDef.findUnique({
          where: { id },
          include: {
            subject: true,
            class: {
              include: {
                board: true,
              },
            },
            chapters: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                name: true,
                order: true,
              },
            },
          },
        });

        if (!syllabus) {
          return NextResponse.json({ error: 'Syllabus not found' }, { status: 404 });
        }

        result = {
          id: syllabus.id,
          type: 'syllabus',
          title: `${syllabus.subject?.name} - Grade ${syllabus.class?.grade}`,
          chapters: syllabus.chapters,
          metadata: {
            board: syllabus.class?.board?.name,
            grade: syllabus.class?.grade,
            subject: syllabus.subject?.name,
            status: syllabus.status,
            chapterCount: syllabus.chapters.length,
          },
        };
        break;
      }

      case 'chapter': {
        const chapter = await prisma.chapterDef.findUnique({
          where: { id },
          include: {
            subject: true,
            topics: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                name: true,
                order: true,
              },
            },
          },
        });

        if (!chapter) {
          return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
        }

        result = {
          id: chapter.id,
          type: 'chapter',
          title: chapter.name,
          topics: chapter.topics,
          metadata: {
            order: chapter.order,
            subject: chapter.subject?.name,
            status: chapter.status,
            topicCount: chapter.topics.length,
          },
        };
        break;
      }

      case 'topic': {
        const topic = await prisma.topicDef.findUnique({
          where: { id },
          include: {
            chapter: {
              include: {
                subject: true,
              },
            },
            notes: {
              select: { id: true, language: true, version: true, status: true },
            },
            tests: {
              select: { id: true, difficulty: true, language: true, status: true },
            },
          },
        });

        if (!topic) {
          return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        }

        result = {
          id: topic.id,
          type: 'topic',
          title: topic.name,
          metadata: {
            order: topic.order,
            chapterName: topic.chapter?.name,
            subject: topic.chapter?.subject?.name,
            status: topic.status,
            noteCount: topic.notes?.length ?? 0,
            testCount: topic.tests?.length ?? 0,
            notes: topic.notes,
            tests: topic.tests,
          },
        };
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    // Log full error with stack for diagnostics
    logger.error('Error fetching content detail', { error });
    const payload = formatErrorForResponse(error);
    return NextResponse.json({ error: payload }, { status: 500 });
  }
}
