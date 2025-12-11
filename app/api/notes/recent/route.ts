import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ notes: [] });
  const notes = await prisma.note.findMany({
    where: { studentId: session.user.id },
    select: { id: true, title: true },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ notes });
}
