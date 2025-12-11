import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ notes: [] });
  const downloads = await prisma.noteDownload.findMany({
    where: { userId: session.user.id },
    select: { noteId: true },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });
  const noteIds = downloads.map((d) => d.noteId);
  const notes = await prisma.note.findMany({
    where: { id: { in: noteIds } },
    select: { id: true, title: true },
  });
  return NextResponse.json({ notes });
}
