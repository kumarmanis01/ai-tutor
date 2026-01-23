/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch single content item details for moderation review.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content-engine/moderation/[id]/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-23T00:00:00Z | copilot | Created GET endpoint for fetching content details
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/admin/content-engine/moderation/[id]?type=note|test
 * Returns detailed content for moderation review
 */
export async function GET(req: Request, { params }: RouteParams) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;
  const url = new URL(req.url);
  const type = url.searchParams.get('type');

  try {
    if (type === 'note') {
      const note = await prisma.topicNote.findUnique({
        where: { id },
        include: {
          topic: {
            select: {
              name: true,
              chapter: {
                select: {
                  name: true,
                  subject: {
                    select: {
                      name: true,
                      classDef: {
                        select: {
                          grade: true,
                          board: { select: { name: true } }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }

      return NextResponse.json({
        content: {
          id: note.id,
          type: 'note',
          title: note.title,
          body: note.contentText,
          contentJson: note.contentJson,
          status: note.status,
          language: note.language,
          version: note.version,
          createdAt: note.createdAt,
          topicName: note.topic?.name,
          chapterName: note.topic?.chapter?.name,
          subjectName: note.topic?.chapter?.subject?.name,
          grade: note.topic?.chapter?.subject?.classDef?.grade,
          board: note.topic?.chapter?.subject?.classDef?.board?.name,
        }
      });
    }

    if (type === 'test') {
      const test = await prisma.generatedTest.findUnique({
        where: { id },
        include: {
          topic: {
            select: {
              name: true,
              chapter: {
                select: {
                  name: true,
                  subject: {
                    select: {
                      name: true,
                      classDef: {
                        select: {
                          grade: true,
                          board: { select: { name: true } }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!test) {
        return NextResponse.json({ error: 'Test not found' }, { status: 404 });
      }

      // Parse questions from JSON if stored as string
      let questions = test.questionsJson;
      if (typeof questions === 'string') {
        try {
          questions = JSON.parse(questions);
        } catch {
          questions = [];
        }
      }

      return NextResponse.json({
        content: {
          id: test.id,
          type: 'test',
          title: test.title,
          questions: Array.isArray(questions) ? questions : [],
          status: test.status,
          language: test.language,
          difficulty: test.difficulty,
          totalMarks: test.totalMarks,
          duration: test.duration,
          version: test.version,
          createdAt: test.createdAt,
          topicName: test.topic?.name,
          chapterName: test.topic?.chapter?.name,
          subjectName: test.topic?.chapter?.subject?.name,
          grade: test.topic?.chapter?.subject?.classDef?.grade,
          board: test.topic?.chapter?.subject?.classDef?.board?.name,
        }
      });
    }

    // Try to find by id if type not specified
    const note = await prisma.topicNote.findUnique({ where: { id } });
    if (note) {
      return NextResponse.json({
        content: {
          id: note.id,
          type: 'note',
          title: note.title,
          body: note.contentText,
          contentJson: note.contentJson,
          status: note.status,
          language: note.language,
        }
      });
    }

    const test = await prisma.generatedTest.findUnique({ where: { id } });
    if (test) {
      let questions = test.questionsJson;
      if (typeof questions === 'string') {
        try {
          questions = JSON.parse(questions);
        } catch {
          questions = [];
        }
      }
      return NextResponse.json({
        content: {
          id: test.id,
          type: 'test',
          title: test.title,
          questions: Array.isArray(questions) ? questions : [],
          status: test.status,
          language: test.language,
        }
      });
    }

    return NextResponse.json({ error: 'Content not found' }, { status: 404 });
  } catch (error) {
    logger.error('[moderation] Failed to fetch content details', { id, type, error });
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}
