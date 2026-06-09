/**
 * FILE OBJECTIVE:
 * - GET /api/chapter/[chapterId]/topics: list active topics for a chapter with
 *   content-availability flags so the UI can show which topics have notes and
 *   questions already seeded by the hydration pipeline.
 *
 * EDIT LOG:
 * - 2026-06-09T18:00:00Z | claude | created for chapter session pipeline integration
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ chapterId: string }> },
) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { chapterId } = await params;

  try {
    const topics = await prisma.topicDef.findMany({
      where: { chapterId, lifecycle: 'active' },
      select: {
        id: true,
        name: true,
        order: true,
        _count: {
          select: {
            notes: { where: { lifecycle: 'active', status: 'approved' } },
            questions: { where: { status: 'ACTIVE' } },
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    type RawTopic = {
      id: string;
      name: string;
      order: number;
      _count: { notes: number; questions: number };
    };
    return NextResponse.json({
      topics: (topics as RawTopic[]).map((t) => ({
        id: t.id,
        name: t.name,
        order: t.order,
        hasNotes: t._count.notes > 0,
        questionCount: t._count.questions,
      })),
    });
  } catch (e) {
    logger.error('chapter.topics.fetch.failed', { chapterId, error: String(e) });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
