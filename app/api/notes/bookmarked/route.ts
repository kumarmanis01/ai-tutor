import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ notes: [] });
  const bookmarks = await prisma.bookmark.findMany({
    where: { studentId: session.user.id, type: 'note' },
    select: { refId: true },
  });
  const noteIds = bookmarks.map((b) => b.refId);
  const notes = await prisma.note.findMany({
    where: { id: { in: noteIds } },
    select: { id: true, title: true },
  });
  return NextResponse.json({ notes });
}
