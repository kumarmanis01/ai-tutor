/**
 * FILE OBJECTIVE:
 * - Lightweight on-demand curriculum loader for cascading dropdowns.
 * - Returns chapters when given ?subjectId= OR topics when given ?chapterId=.
 * - Does NOT return full curriculum. Load-on-demand only.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created for BrowseNotesSection lazy loading
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subjectId');
  const chapterId = searchParams.get('chapterId');

  // Return chapters for a subject
  if (subjectId) {
    const chapters = await prisma.chapterDef.findMany({
      where: { subjectId, lifecycle: 'active' },
      select: { id: true, name: true, slug: true, order: true },
      orderBy: { order: 'asc' },
    });
    return NextResponse.json({ chapters });
  }

  // Return topics for a chapter
  if (chapterId) {
    const topics = await prisma.topicDef.findMany({
      where: { chapterId, lifecycle: 'active' },
      select: { id: true, name: true, slug: true, order: true },
      orderBy: { order: 'asc' },
    });
    return NextResponse.json({ topics });
  }

  return NextResponse.json({ error: 'subjectId or chapterId required' }, { status: 400 });
}
