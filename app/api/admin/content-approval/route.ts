/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch all pending content (draft status) for admin approval.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content-approval/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T04:00:00Z | copilot | Created content-approval API for fetching pending content
 * - 2026-01-22T06:30:00Z | copilot | Fixed relation chain: topic.chapter.subject.class.board (was incorrectly using syllabus)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

interface PendingContentItem {
  id: string;
  type: 'note' | 'test' | 'topic' | 'chapter';
  label: string;
  status: string;
  createdAt: Date;
  details: Record<string, unknown>;
}

/**
 * GET /api/admin/content-approval
 * Returns all content pending approval (draft status)
 */
export async function GET() {
  logger.info('[content-approval] API called');
  
  const session = await getServerSessionForHandlers();
  logger.info('[content-approval] Session fetched', { hasSession: !!session, role: session?.user?.role });
  
  if (!session?.user?.id || session.user.role !== 'admin') {
    logger.warn('[content-approval] Forbidden - no admin session');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    logger.info('[content-approval] Fetching draft notes...');
    const pendingItems: PendingContentItem[] = [];

    // Fetch draft notes
    // Relation chain: TopicNote -> topic (TopicDef) -> chapter (ChapterDef) -> subject (SubjectDef) -> class (ClassLevel) -> board (Board)
    const draftNotes = await prisma.topicNote.findMany({
      where: { status: 'draft', lifecycle: 'active' },
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
                    class: {
                      select: {
                        grade: true,
                        board: {
                          select: {
                            name: true,
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    for (const note of draftNotes) {
      const subjectDef = note.topic?.chapter?.subject;
      const classLevel = subjectDef?.class;
      pendingItems.push({
        id: note.id,
        type: 'note',
        label: `Note: ${note.title || note.topic?.name || 'Untitled'}`,
        status: note.status,
        createdAt: note.createdAt,
        details: {
          topicId: note.topicId,
          topicName: note.topic?.name,
          chapterName: note.topic?.chapter?.name,
          board: classLevel?.board?.name,
          grade: classLevel?.grade,
          subject: subjectDef?.name,
          language: note.language,
          version: note.version,
        },
      });
    }

    // Fetch draft tests
    // Same relation chain as notes
    const draftTests = await prisma.generatedTest.findMany({
      where: { status: 'draft', lifecycle: 'active' },
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
                    class: {
                      select: {
                        grade: true,
                        board: {
                          select: {
                            name: true,
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        questions: {
          select: { id: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    for (const test of draftTests) {
      const subjectDef = test.topic?.chapter?.subject;
      const classLevel = subjectDef?.class;
      pendingItems.push({
        id: test.id,
        type: 'test',
        label: `Test: ${test.title} (${test.difficulty})`,
        status: test.status,
        createdAt: test.createdAt,
        details: {
          topicId: test.topicId,
          topicName: test.topic?.name,
          chapterName: test.topic?.chapter?.name,
          board: classLevel?.board?.name,
          grade: classLevel?.grade,
          subject: subjectDef?.name,
          difficulty: test.difficulty,
          language: test.language,
          questionCount: test.questions.length,
          version: test.version,
        },
      });
    }

    // Sort all items by createdAt descending
    pendingItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Get counts for summary
    const summary = {
      totalPending: pendingItems.length,
      notes: pendingItems.filter((i) => i.type === 'note').length,
      tests: pendingItems.filter((i) => i.type === 'test').length,
    };

    return NextResponse.json({ items: pendingItems, summary });
  } catch (error) {
    logger.error('Failed to fetch pending content', { error });
    return NextResponse.json({ error: 'Failed to fetch pending content' }, { status: 500 });
  }
}
