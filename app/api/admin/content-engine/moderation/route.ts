/**
 * FILE OBJECTIVE:
 * - API endpoint for content moderation - fetches pending content for review.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/content-engine/moderation/route.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-22T08:00:00Z | copilot | Created moderation API endpoint
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/content-engine/moderation
 * Returns all content pending moderation (draft notes, tests, etc.)
 */
export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Fetch draft notes
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
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Fetch draft tests
    const draftTests = await prisma.generatedTest.findMany({
      where: { status: 'draft', lifecycle: 'active' },
      include: {
        topic: {
          select: {
            name: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Combine and format for display
    type NoteItem = typeof draftNotes[number];
    type TestItem = typeof draftTests[number];
    
    const contents = [
      ...draftNotes.map((n: NoteItem) => ({
        id: n.id,
        type: 'note' as const,
        status: n.status,
        language: n.language,
        createdAt: n.createdAt,
        topicName: n.topic?.name || n.title,
        subject: n.topic?.chapter?.subject?.name,
        chapter: n.topic?.chapter?.name,
        topic: n.topic?.name,
      })),
      ...draftTests.map((t: TestItem) => ({
        id: t.id,
        type: 'test' as const,
        status: t.status,
        language: t.language,
        createdAt: t.createdAt,
        topicName: t.title || t.topic?.name,
        difficulty: t.difficulty,
        topic: t.topic?.name,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ contents });
  } catch (error) {
    logger.error('[moderation] Failed to fetch moderation queue', { error });
    return NextResponse.json({ error: 'Failed to fetch moderation queue' }, { status: 500 });
  }
}
