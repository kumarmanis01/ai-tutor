/**
 * FILE OBJECTIVE:
 * - API endpoint to fetch all pending content (draft status) for admin approval.
 * - Supports all hydrated content: syllabus, chapters, topics, notes, tests.
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
 * - 2026-01-22T06:55:00Z | copilot | Added support for all hydrated content types: syllabus, chapters, topics
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';

interface PendingContentItem {
  id: string;
  type: 'syllabus' | 'chapter' | 'topic' | 'note' | 'test';
  label: string;
  status: string;
  createdAt: Date;
  details: Record<string, unknown>;
}

interface ContentSummary {
  totalPending: number;
  syllabus: number;
  chapters: number;
  topics: number;
  notes: number;
  tests: number;
}

/**
 * GET /api/admin/content-approval
 * Returns all content pending approval (draft status) from all hydrators
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
    logger.info('[content-approval] Fetching all draft content...');
    const pendingItems: PendingContentItem[] = [];

    // 1. Fetch draft syllabus (SyllabusStatus.DRAFT)
    const draftSyllabus = await prisma.syllabus.findMany({
      where: { status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    for (const syl of draftSyllabus) {
      pendingItems.push({
        id: syl.id,
        type: 'syllabus',
        label: `Syllabus: ${syl.title}`,
        status: syl.status,
        createdAt: syl.createdAt,
        details: {
          title: syl.title,
          version: syl.version,
        },
      });
    }

    // 2. Fetch draft chapters (ApprovalStatus.draft)
    // Relation chain: ChapterDef -> subject (SubjectDef) -> class (ClassLevel) -> board (Board)
    const draftChapters = await prisma.chapterDef.findMany({
      where: { status: 'draft', lifecycle: 'active' },
      include: {
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
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    for (const chapter of draftChapters) {
      const classLevel = chapter.subject?.class;
      pendingItems.push({
        id: chapter.id,
        type: 'chapter',
        label: `Chapter: ${chapter.name}`,
        status: chapter.status,
        createdAt: chapter.createdAt,
        details: {
          chapterName: chapter.name,
          order: chapter.order,
          subject: chapter.subject?.name,
          board: classLevel?.board?.name,
          grade: classLevel?.grade,
          version: chapter.version,
        },
      });
    }

    // 3. Fetch draft topics (ApprovalStatus.draft)
    // Relation chain: TopicDef -> chapter (ChapterDef) -> subject (SubjectDef) -> class (ClassLevel) -> board (Board)
    const draftTopics = await prisma.topicDef.findMany({
      where: { status: 'draft', lifecycle: 'active' },
      include: {
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
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    for (const topic of draftTopics) {
      const subjectDef = topic.chapter?.subject;
      const classLevel = subjectDef?.class;
      pendingItems.push({
        id: topic.id,
        type: 'topic',
        label: `Topic: ${topic.name}`,
        status: topic.status,
        createdAt: topic.createdAt,
        details: {
          topicName: topic.name,
          order: topic.order,
          chapterName: topic.chapter?.name,
          subject: subjectDef?.name,
          board: classLevel?.board?.name,
          grade: classLevel?.grade,
        },
      });
    }

    // 4. Fetch draft notes (ApprovalStatus.draft)
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

    // 5. Fetch draft tests (ApprovalStatus.draft)
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
    const summary: ContentSummary = {
      totalPending: pendingItems.length,
      syllabus: pendingItems.filter((i) => i.type === 'syllabus').length,
      chapters: pendingItems.filter((i) => i.type === 'chapter').length,
      topics: pendingItems.filter((i) => i.type === 'topic').length,
      notes: pendingItems.filter((i) => i.type === 'note').length,
      tests: pendingItems.filter((i) => i.type === 'test').length,
    };

    logger.info('[content-approval] Fetched pending content', { summary });

    return NextResponse.json({ items: pendingItems, summary });
  } catch (error) {
    // log full error with stack
    logger.error('Failed to fetch pending content', { error });
    const payload = formatErrorForResponse(error);
    return NextResponse.json({ error: payload }, { status: 500 });
  }
}
