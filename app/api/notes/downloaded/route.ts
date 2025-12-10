import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ notes: [] });
  // Using bookmarks of type 'download' to approximate downloaded items (adjust if a dedicated model exists)
  const downloads = await prisma.bookmark.findMany({
    where: { studentId: session.user.id, type: 'download' },
    select: { refId: true },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });
  const noteIds = downloads.map((b) => b.refId);
  const notes = await prisma.note.findMany({
    where: { id: { in: noteIds } },
    select: { id: true, title: true },
  });
  return NextResponse.json({ notes });
}
