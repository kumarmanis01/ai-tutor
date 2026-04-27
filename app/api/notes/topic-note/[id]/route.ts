import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notes/topic-note/[id]
 *
 * Returns a single TopicNote by id (approved, active only).
 * Used when the Notes page loads note content for a selected topic.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    const note = await prisma.topicNote.findFirst({
      where: {
        id,
        lifecycle: 'active',
        status: 'approved',
      },
      select: {
        id: true,
        title: true,
        contentJson: true,
        language: true,
        version: true,
        topicId: true,
      },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (err) {
    logger.error('NotesTopicNoteAPI.error', { id, error: err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
